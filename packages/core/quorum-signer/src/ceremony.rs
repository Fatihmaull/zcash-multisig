//! A key ceremony that never assembles the key.
//!
//! This is the distributed counterpart to `examples/ceremony.rs`. That one
//! runs all three participants in one process and says so in its own output;
//! this one runs one participant, talks to the others over `frostd`, and is
//! the reason the project may say *no party ever saw more than one share*
//! rather than only *no party sees more than one share while signing*.
//!
//! The FROST rounds themselves live in [`quorum_core::dkg`] and move no
//! bytes. What is here is the choreography: who sends what to whom, over
//! which channel, and what must be checked before anyone trusts the result.
//!
//! # Channels — the asymmetry that matters
//!
//! Constraint C5 says round 1 needs an authenticated channel and round 2
//! needs an authenticated *and confidential* one. We give both rounds the
//! same treatment — per-recipient `Noise_K` — for a reason that is about
//! code rather than cryptography: a broadcast path that skips encryption is
//! a path someone can later route a round-2 package down. There is no such
//! path here. Everything that leaves this module is sealed to exactly one
//! peer.
//!
//! # Who a message is from
//!
//! **The sender is the Noise key that decrypted the message, never a field
//! inside it.** `Noise_K` is authenticated: a payload that decrypts under a
//! peer's static key was written by the holder of that peer's private key.
//! A self-declared `from` would let any participant attribute their package
//! to somebody else, and in DKG that is not a logging inconvenience — it
//! decides whose share ends up in the vault.
//!
//! # The vault seed
//!
//! `ak` comes out of FROST; `nk` and `rivk` come from a [`VaultSeed`] that
//! has to be agreed once and kept forever. One participant generates it and
//! sends it alongside their round-2 packages, inside the same Noise
//! envelope, because it is a shared secret and the relay must not see it.
//!
//! That participant could send a different seed to each peer. They gain
//! nothing by it — everyone learns the seed regardless, so there is no
//! secret to steal — but the vault would silently split into per-participant
//! addresses, and funds sent to one of them would be unspendable by a
//! quorum. We have already lost testnet funds to a seed disagreement once.
//! Hence the confirmation round below.
//!
//! # The confirmation round
//!
//! After round 3, everyone broadcasts the group verifying key and the
//! derived address and refuses to write anything unless all of them match.
//! The single-process fixture can assert this trivially; distributed, it is
//! the only thing standing between a disagreement and a stranded vault.
//!
//! See `docs/03-architecture.md` §2 and constraint C5.

use std::collections::BTreeMap;
use std::time::Duration;

use frost_core::keys::dkg::{round1, round2};
use frost_core::keys::{KeyPackage, PublicKeyPackage};
use quorum_core::dkg::{DkgError, Round1, VaultConfig, VaultIdentifier};
use quorum_core::transport::{
    Cipher, CipherError, FrostdClient, FrostdError, Identity, PeerPublicKey, SessionId,
};
use quorum_core::vault_key::{VaultKey, VaultKeyError, VaultSeed};
use quorum_core::Ciphersuite;
use rand_core::{CryptoRng, RngCore};
use serde::{Deserialize, Serialize};
use zcash_keys::address::UnifiedAddress;
use zcash_protocol::consensus::TEST_NETWORK;

/// How long to wait for a round to complete before giving up.
///
/// DKG has no threshold: every participant must answer or there is no vault.
/// A timeout here means restart the ceremony, not proceed with fewer.
pub const DEFAULT_ROUND_TIMEOUT: Duration = Duration::from_secs(120);

/// How often to ask the relay for new messages. `frostd` does not block.
const POLL_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Debug, thiserror::Error)]
pub enum CeremonyError {
    #[error(transparent)]
    Dkg(#[from] DkgError),

    #[error(transparent)]
    Frostd(#[from] FrostdError),

    #[error(transparent)]
    Cipher(#[from] CipherError),

    #[error(transparent)]
    VaultKey(#[from] VaultKeyError),

    #[error("could not encode the ceremony message: {0}")]
    Encoding(#[from] serde_json::Error),

    /// A message arrived from a key that is not in the roster.
    ///
    /// The relay let somebody into the session who should not be there, or
    /// the roster is wrong. Either way this is not recoverable by retrying:
    /// a ceremony with an unexpected participant is a ceremony with an
    /// unexpected shareholder.
    #[error("a message arrived from {0}, who is not in the roster — aborting")]
    Stranger(String),

    /// A peer sent something out of turn.
    #[error("{label} sent a {got} message during {expected}")]
    OutOfOrder {
        label: String,
        got: &'static str,
        expected: &'static str,
    },

    #[error("{round} did not complete within {}s — heard from {heard} of {expected}; missing {missing}", timeout.as_secs())]
    Timeout {
        round: &'static str,
        heard: usize,
        expected: usize,
        missing: String,
        timeout: Duration,
    },

    /// Two participants disagree about what vault they just built.
    ///
    /// Writing a share here would produce a vault whose members cannot sign
    /// together and whose address may already have received funds nobody can
    /// spend. Abort, and do not write anything.
    #[error(
        "the ceremony produced a DISAGREEMENT and has been aborted.\n  \
         we derived   group key {ours_key}\n               address   {ours_addr}\n  \
         {label} derived group key {theirs_key}\n               address   {theirs_addr}\n\
         No share has been written. Do not fund either address. Restart the ceremony \
         with a verified roster."
    )]
    Disagreement {
        label: String,
        ours_key: String,
        ours_addr: String,
        theirs_key: String,
        theirs_addr: String,
    },

    /// Nobody sent the vault seed.
    #[error(
        "the ceremony finished without a vault seed — exactly one participant must be \
         configured to contribute it"
    )]
    NoSeed,

    /// Two participants both tried to contribute a seed.
    #[error(
        "two participants contributed a vault seed; the roster must designate exactly one \
         and the others must wait for it"
    )]
    DuplicateSeed,

    #[error("the roster is unusable: {0}")]
    BadRoster(String),
}

/// One participant, as everyone else knows them before the ceremony starts.
///
/// This struct is the contact-verification artifact. `Noise_K` assumes both
/// parties already hold each other's correct static keys, so **every field
/// here is trusted absolutely** — an attacker who substitutes a `pubkey` is
/// a shareholder in the resulting vault. Verifying these out of band is a
/// step the user performs deliberately; it is not setup chrome.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Member {
    pub label: String,
    /// FROST identifier, hex, in the same form the coordinator speaks.
    pub identifier: String,
    /// X25519 static public key: the frostd login identity and the Noise key.
    pub pubkey: String,
}

/// Everyone in the ceremony, and the shape of the vault.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Roster {
    pub threshold: u16,
    pub participants: Vec<Member>,
}

/// A roster with its hex fields parsed, so the ceremony never re-parses.
struct Parsed {
    config: VaultConfig,
    me: VaultIdentifier,
    /// Every *other* participant.
    peers: Vec<Peer>,
}

#[derive(Clone)]
struct Peer {
    label: String,
    identifier: VaultIdentifier,
    pubkey: PeerPublicKey,
}

impl Roster {
    fn parse(&self, my_pubkey: &PeerPublicKey) -> Result<Parsed, CeremonyError> {
        if self.participants.len() > u16::MAX as usize {
            return Err(CeremonyError::BadRoster("too many participants".into()));
        }
        let total = self.participants.len() as u16;
        let config = VaultConfig::new(self.threshold, total)?;

        let mut me = None;
        let mut peers = Vec::new();
        for m in &self.participants {
            let pubkey = PeerPublicKey::from_hex(&m.pubkey)
                .map_err(|e| CeremonyError::BadRoster(format!("{}: bad pubkey — {e}", m.label)))?;
            let identifier = parse_identifier(&m.identifier).map_err(|e| {
                CeremonyError::BadRoster(format!("{}: bad identifier — {e}", m.label))
            })?;

            if &pubkey == my_pubkey {
                if me.is_some() {
                    return Err(CeremonyError::BadRoster(
                        "our own key appears twice in the roster".into(),
                    ));
                }
                me = Some(identifier);
            } else {
                peers.push(Peer {
                    label: m.label.clone(),
                    identifier,
                    pubkey,
                });
            }
        }

        let me = me.ok_or_else(|| {
            CeremonyError::BadRoster(
                "our own public key is not in the roster; we were not invited to this ceremony"
                    .into(),
            )
        })?;

        Ok(Parsed { config, me, peers })
    }
}

fn parse_identifier(hex_str: &str) -> Result<VaultIdentifier, String> {
    let raw = hex::decode(hex_str).map_err(|e| e.to_string())?;
    VaultIdentifier::deserialize(&raw).map_err(|e| e.to_string())
}

/// Whether this participant generates the vault seed or waits for it.
///
/// Exactly one participant in a ceremony contributes; the rest wait. Two
/// contributors is an error rather than a tie-break, because silently
/// picking one would mean silently picking an address.
pub enum SeedRole {
    Contribute,
    /// **Demo and test only.** Send a *different* seed to every peer.
    ///
    /// Everything cryptographic still succeeds: FROST does not know or care
    /// what the seed is, so all three participants finish round 3 holding
    /// valid shares of the same group key. What differs is `nk` and `rivk`,
    /// and therefore the address — three participants, three vaults, one of
    /// which may already have been funded.
    ///
    /// This failure is silent without the confirmation round, which is the
    /// whole reason there is one. Reproducing it is how we know the check
    /// works rather than merely exists.
    ContributeInconsistently,
    Await,
}

/// What a completed ceremony leaves this participant holding.
pub struct Outcome {
    /// **This participant's share.** Never leaves the machine.
    pub key_package: KeyPackage<Ciphersuite>,
    /// Public. The coordinator needs it; so does anyone verifying a signature.
    pub public_key_package: PublicKeyPackage<Ciphersuite>,
    /// Shared secret. Every participant needs it to scan; anyone holding it
    /// can read the vault's entire history.
    pub seed: VaultSeed,
    /// Testnet unified address, Orchard receiver only.
    pub address: String,
}

// ── Wire format ──────────────────────────────────────────────
//
// Note what is absent: a sender field. See the module docs.

#[derive(Serialize, Deserialize)]
#[serde(tag = "step", rename_all = "camelCase")]
enum Envelope {
    Round1 {
        package: round1::Package<Ciphersuite>,
    },
    Round2 {
        package: round2::Package<Ciphersuite>,
        /// Present only from the seed contributor. Secret — this is why the
        /// round-2 envelope is sealed rather than broadcast.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        vault_seed: Option<String>,
    },
    Confirm {
        group_key: String,
        address: String,
    },
}

impl Envelope {
    fn kind(&self) -> &'static str {
        match self {
            Envelope::Round1 { .. } => "round 1",
            Envelope::Round2 { .. } => "round 2",
            Envelope::Confirm { .. } => "confirmation",
        }
    }

    /// Whether this message could honestly have been sent while we are still
    /// collecting `phase`.
    ///
    /// Only *forward* skew is legitimate. A peer cannot send round 2 before
    /// it has our round 1, nor a confirmation before it has our round 2, so
    /// anything from an earlier phase than the one we are in is either a
    /// replay or a peer that is not running this protocol.
    fn may_arrive_during(&self, phase: &str) -> bool {
        matches!(
            (phase, self),
            ("round 1", Envelope::Round1 { .. } | Envelope::Round2 { .. })
                | (
                    "round 2",
                    Envelope::Round2 { .. } | Envelope::Confirm { .. }
                )
                | ("confirmation", Envelope::Confirm { .. })
        )
    }
}

/// Anything that arrived before we were ready for it.
///
/// A peer that finishes a round early will send the next one while we are
/// still collecting the current one. Dropping those and asking again is not
/// an option: `Noise_K` sessions are ordered, so a message we decline to
/// decrypt is a message we can never decrypt. Everything is decrypted on
/// arrival and parked here.
#[derive(Default)]
struct Mailbox {
    round1: BTreeMap<VaultIdentifier, round1::Package<Ciphersuite>>,
    round2: BTreeMap<VaultIdentifier, round2::Package<Ciphersuite>>,
    confirm: BTreeMap<VaultIdentifier, (String, String)>,
    seed: Option<VaultSeed>,
}

/// Run the ceremony to completion as one participant.
///
/// `session` must already exist on the relay — creating and joining it is
/// the caller's business, because who opens the session is a deployment
/// question and carries no authority over the vault either way.
pub async fn run<R: RngCore + CryptoRng>(
    identity: &Identity,
    roster: &Roster,
    client: &FrostdClient,
    session: SessionId,
    seed_role: SeedRole,
    timeout: Duration,
    mut rng: R,
) -> Result<Outcome, CeremonyError> {
    let parsed = roster.parse(identity.public_key())?;
    let peer_keys: Vec<PeerPublicKey> = parsed.peers.iter().map(|p| p.pubkey.clone()).collect();
    let mut cipher = Cipher::new(identity.private_key(), &peer_keys)?;
    let mut mailbox = Mailbox::default();

    // The seed is generated before round 1 so that a contributor who crashes
    // mid-ceremony does not produce a different vault on restart — the
    // restart is a fresh ceremony either way, but the ordering keeps the one
    // irreversible choice in one place.
    let equivocate = matches!(seed_role, SeedRole::ContributeInconsistently);
    let my_seed = match seed_role {
        SeedRole::Contribute | SeedRole::ContributeInconsistently => {
            Some(VaultSeed::generate(&mut rng))
        }
        SeedRole::Await => None,
    };

    // ── Round 1 — commitments, sealed to each peer individually ──
    let round1 = Round1::begin(parsed.me, parsed.config, &mut rng)?;
    let announcement = Envelope::Round1 {
        package: round1.broadcast_package().clone(),
    };
    for peer in &parsed.peers {
        send_sealed(client, &mut cipher, session, peer, &announcement).await?;
    }

    collect(
        client,
        &mut cipher,
        session,
        &parsed,
        &mut mailbox,
        timeout,
        "round 1",
        |m| m.round1.len(),
        |m| m.round1.keys().copied().collect(),
    )
    .await?;

    let round2 = round1.receive(std::mem::take(&mut mailbox.round1))?;

    // ── Round 2 — one secret package per recipient ──
    let by_identifier: BTreeMap<VaultIdentifier, &Peer> =
        parsed.peers.iter().map(|p| (p.identifier, p)).collect();

    for (recipient, package) in round2.packages_to_send() {
        let peer = by_identifier.get(recipient).ok_or_else(|| {
            CeremonyError::BadRoster(format!(
                "FROST produced a package for {}, who is not in the roster",
                hex::encode(recipient.serialize())
            ))
        })?;
        let vault_seed = my_seed.as_ref().map(|mine| {
            if equivocate {
                hex::encode(VaultSeed::generate(&mut rng).as_bytes())
            } else {
                hex::encode(mine.as_bytes())
            }
        });
        let envelope = Envelope::Round2 {
            package: package.clone(),
            vault_seed,
        };
        send_sealed(client, &mut cipher, session, peer, &envelope).await?;
    }

    collect(
        client,
        &mut cipher,
        session,
        &parsed,
        &mut mailbox,
        timeout,
        "round 2",
        |m| m.round2.len(),
        |m| m.round2.keys().copied().collect(),
    )
    .await?;

    let finished = round2.receive(std::mem::take(&mut mailbox.round2))?;

    // ── The vault key ──
    let seed = match (my_seed, mailbox.seed.take()) {
        (Some(mine), None) => mine,
        (None, Some(theirs)) => theirs,
        (Some(_), Some(_)) => return Err(CeremonyError::DuplicateSeed),
        (None, None) => return Err(CeremonyError::NoSeed),
    };

    let vault = VaultKey::derive(&finished.public_key_package, &seed)?;
    // Ironwood reuses Orchard's address format, so one receiver serves both
    // pools — which pool a note lands in is the sender's choice.
    let address = UnifiedAddress::from_receivers(Some(vault.address()), None, None)
        .expect("an Orchard receiver is a valid unified address")
        .encode(&TEST_NETWORK);
    let group_key = hex::encode(
        finished
            .public_key_package
            .verifying_key()
            .serialize()
            .map_err(DkgError::from)?,
    );

    // ── Confirmation — the round the fixture never needed ──
    let confirmation = Envelope::Confirm {
        group_key: group_key.clone(),
        address: address.clone(),
    };
    for peer in &parsed.peers {
        send_sealed(client, &mut cipher, session, peer, &confirmation).await?;
    }

    collect(
        client,
        &mut cipher,
        session,
        &parsed,
        &mut mailbox,
        timeout,
        "confirmation",
        |m| m.confirm.len(),
        |m| m.confirm.keys().copied().collect(),
    )
    .await?;

    for peer in &parsed.peers {
        let (theirs_key, theirs_addr) = mailbox
            .confirm
            .get(&peer.identifier)
            .expect("collect returned once every peer answered");
        if theirs_key != &group_key || theirs_addr != &address {
            return Err(CeremonyError::Disagreement {
                label: peer.label.clone(),
                ours_key: group_key,
                ours_addr: address,
                theirs_key: theirs_key.clone(),
                theirs_addr: theirs_addr.clone(),
            });
        }
    }

    Ok(Outcome {
        key_package: finished.key_package,
        public_key_package: finished.public_key_package,
        seed,
        address,
    })
}

async fn send_sealed(
    client: &FrostdClient,
    cipher: &mut Cipher,
    session: SessionId,
    peer: &Peer,
    envelope: &Envelope,
) -> Result<(), CeremonyError> {
    let plaintext = serde_json::to_vec(envelope)?;
    let sealed = cipher.encrypt(&peer.pubkey, &plaintext)?;
    client
        .send(session, std::slice::from_ref(&peer.pubkey), &sealed)
        .await?;
    Ok(())
}

/// Poll the relay until every peer has answered the current round.
///
/// Messages for later rounds are decrypted and parked rather than dropped,
/// because a `Noise_K` session is ordered: skipping one ciphertext makes
/// every later one from that peer undecryptable.
#[allow(clippy::too_many_arguments)]
async fn collect(
    client: &FrostdClient,
    cipher: &mut Cipher,
    session: SessionId,
    parsed: &Parsed,
    mailbox: &mut Mailbox,
    timeout: Duration,
    round: &'static str,
    have: fn(&Mailbox) -> usize,
    heard_from: fn(&Mailbox) -> Vec<VaultIdentifier>,
) -> Result<(), CeremonyError> {
    let expected = parsed.peers.len();
    let deadline = tokio::time::Instant::now() + timeout;

    while have(mailbox) < expected {
        if tokio::time::Instant::now() >= deadline {
            let heard = heard_from(mailbox);
            let missing: Vec<&str> = parsed
                .peers
                .iter()
                .filter(|p| !heard.contains(&p.identifier))
                .map(|p| p.label.as_str())
                .collect();
            return Err(CeremonyError::Timeout {
                round,
                heard: heard.len(),
                expected,
                missing: missing.join(", "),
                timeout,
            });
        }

        for relayed in client.receive(session, false).await? {
            // Who this is from is decided here and nowhere else: the roster
            // entry for the key that the relay says sent it, confirmed by
            // that key's Noise session decrypting the payload.
            let peer = parsed
                .peers
                .iter()
                .find(|p| p.pubkey == relayed.sender)
                .ok_or_else(|| CeremonyError::Stranger(relayed.sender.to_hex()))?;

            let plaintext = cipher.decrypt(&peer.pubkey, &relayed.ciphertext)?;
            let envelope: Envelope = serde_json::from_slice(&plaintext)?;

            // Running ahead is normal: a peer who has everyone's round 1
            // sends round 2 while we are still waiting on a slow third
            // party. Running *behind* the protocol is not — a confirmation
            // during round 1 would mean its sender finished round 3 without
            // our round-2 package, which cannot happen honestly.
            if !envelope.may_arrive_during(round) {
                return Err(CeremonyError::OutOfOrder {
                    label: peer.label.clone(),
                    got: envelope.kind(),
                    expected: round,
                });
            }

            match envelope {
                Envelope::Round1 { package } => {
                    mailbox.round1.insert(peer.identifier, package);
                }
                Envelope::Round2 {
                    package,
                    vault_seed,
                } => {
                    if let Some(hex_seed) = vault_seed {
                        let raw = hex::decode(&hex_seed).map_err(|e| {
                            CeremonyError::BadRoster(format!(
                                "{} sent an unreadable vault seed: {e}",
                                peer.label
                            ))
                        })?;
                        let bytes: [u8; 32] = raw.as_slice().try_into().map_err(|_| {
                            CeremonyError::BadRoster(format!(
                                "{} sent a {}-byte vault seed; it must be 32",
                                peer.label,
                                raw.len()
                            ))
                        })?;
                        if mailbox.seed.is_some() {
                            return Err(CeremonyError::DuplicateSeed);
                        }
                        mailbox.seed = Some(VaultSeed::from_bytes(bytes));
                    }
                    mailbox.round2.insert(peer.identifier, package);
                }
                Envelope::Confirm { group_key, address } => {
                    mailbox
                        .confirm
                        .insert(peer.identifier, (group_key, address));
                }
            }
        }

        if have(mailbox) < expected {
            tokio::time::sleep(POLL_INTERVAL).await;
        }
    }

    Ok(())
}
