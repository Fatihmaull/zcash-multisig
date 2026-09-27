# Quorum — Submission Draft (Zcash Track)

> **P4-4 | Dev B edits, Dev A checked the claims.** Every technical assertion below was
> verified against the repository on 25 Sep 2026. Places needing Dev B are marked
> `<!-- DEV B -->`. Nothing here is aspirational; if a sentence describes something we have
> not done, it is a bug in the draft.
>
> **Before publishing, one named person re-reads this against [06-risk-register.md](06-risk-register.md) R6.**
> Overstating the security posture of a custody product in front of an audience of
> cryptographers is worse than missing the deadline.

---

## 1. What Quorum is

**Shared custody for Zcash shielded funds.** A 2-of-3 organisation can hold ZEC in the
shielded pool, approve a spend through a process that a treasurer can actually follow, and
prove afterwards — to an auditor, with a viewing key — that what happened is what was
approved.

**What it is not:** it is not the cryptography, which exists and was written by better
cryptographers than us. It is not the transport, which is the Zcash Foundation's `frostd`.
It is not "FROST tooling for Zcash" — that is the Foundation's lane and we would lose that
fight. **Quorum is the organisational governance layer in between**, and that layer is
missing today.

| | |
|---|---|
| **Track** | Zcash |
| **Network** | Zcash **testnet** only. No mainnet funds have ever touched this build. |
| **Pool** | **Ironwood** (NU6.3, mainnet-activated 28 July 2026 at block 3,428,143). Orchard is exit-only and accepts no new shielded activity. |
| **Repository** | https://github.com/Fatihmaull/zcash-multisig |
| **Reproduce it** | [docs/16-runbook.md](16-runbook.md) — clean machine to a confirmed spend, every command verified |
| **Live demo** | <!-- DEV B: deployed URL, or delete this row --> |
| **Video** | <!-- DEV B: link --> |

---

## 2. The evidence, first

Two real transactions on Zcash testnet, both 2-of-3 threshold-signed shielded **Ironwood**
spends.

| | txid | Block | What it proves |
|---|---|---|---|
| **25 Sep** | `259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61` | 4,390,493 | **The one that matters.** Its three key shares were generated in three separate OS processes, over a real `frostd`, and were never in the same place — not while signing, and not while being created. |
| 23 Sep | `0ef1e96411b770fb0aec7d35c820510cd303f696126ac85782158c75382681ce` | 4,383,363 | The first one. Its vault came from a single-process development fixture, so it proves the spend path but not the custody claim. |

We keep these apart deliberately. They are not interchangeable, and presenting them as one
number would be the first dishonest thing in this document.

**How to check them.** A block explorer will confirm these transactions exist and are
shielded, and that is all it can do — the contents of a shielded spend are not public, which
is rather the point. The verification that means something uses the vault's **viewing key**:

```bash
UFVK=$(cargo run -q -p quorum-signer --example vault_ufvk -- ./secrets/ceremony \
       | grep -oE 'uviewtest1[a-z0-9]+')
zcash-devtool wallet -w ./watch init-fvk --name vault --fvk "$UFVK" --birthday 4383000
zcash-devtool wallet -w ./watch sync && zcash-devtool wallet -w ./watch list-tx
```

That is the same mechanism as F6 below, and the same one an auditor would use. It reads the
chain, not our database.

<!-- DEV B: if you find a testnet explorer that renders these reliably, link it — but keep
     the viewing-key method as the primary. It is the stronger claim and it is ours. -->

Also: 42 tests, including a 2-of-3 signature verified by **Orchard's own verifier** against
`rk = ak.randomize(alpha)` — not by our code agreeing with our code.

---

## 3. The problem

An organisation holding ZEC today picks one of two bad options.

**Transparent funds with multisig.** Shared control works. Every vendor payment, salary,
runway figure and counterparty is public forever. For a privacy-focused foundation that is a
contradiction; for anyone else it is a security problem, because an observable treasury is a
targetable one.

**Shielded funds with a single key.** Privacy works. Now one person, one laptop, one seed
phrase stands between the organisation and total loss — and that person can be compromised,
coerced, hit by a bus, or simply leave.

There is no third option. Shielded multisig is the missing primitive, and the tooling around
it — the part a treasurer touches — does not exist at all.

---

## 4. Why this is possible now and was not a year ago

**In the v6 transaction format, the shielded anchor is authorizing data.** It can be chosen
*after* signatures are collected, at broadcast time.

That sounds like a footnote. It is the whole reason a *usable* shielded multisig is possible.

Signer 1 approves at 09:00. Signer 2 opens their laptop at 16:00. Under the older format the
anchor chosen at build time has gone stale, the transaction must be rebuilt, and **every
signature already collected is discarded.** A 2-of-3 organisation spread across time zones
could not close a round. v6 removes that failure mode, and with it the reason shielded
threshold custody was a research demo rather than a product.

> A note on a claim you may see elsewhere: this is a property of the **v6 transaction
> format**, not of ZIP-2005. ZIP-2005 changed *note construction* for quantum recoverability
> and has nothing to do with anchor deferrability. An earlier draft of this document
> conflated them.

---

## 5. What we built

Four things a treasurer sees, each backed by something a cryptographer can check.

**F1 — A key ceremony that is actually distributed.** `./scripts/three-party-ceremony.sh`
starts three `quorum-dkgd` processes and a real `frostd`. Each produces exactly one sealed
share and never sends it. Round-2 packages carry secret share material, so they are sealed
per recipient with `Noise_K_25519_ChaChaPoly_BLAKE2s` — a test asserts the relay carried
nothing parseable and never the vault seed.

**F3 — Signer coordination that survives a human.** A signer who never answers is marked
`TIMEOUT`, not blamed, and the request continues. The most common failure of shared control
is someone on a plane, not malice.

**F4 — A misbehaving signer, named.** An invalid share is attributed to the participant who
sent it, by name, from `InvalidSignatureShare::culprits` — and the message says the thing a
treasurer needs to hear first: *"This vault has not been charged and no funds moved."*
Reproducible with `MISBEHAVE=Bob`, because a demo beat you cannot repeat is a demo beat you
cannot record.

**F6 — An audit trail backed by the chain, not by us.** The export carries the vault's
**unified full viewing key** alongside the event log, and says so plainly: *the event log is
ours, the chain is not.* An auditor reconciles one against the other. A log we control,
presented alone, is worth nothing and we do not pretend otherwise.

---

## 6. Architecture and the trust boundary

```
  Alice                 Bob                  Carol
  quorum-signerd        quorum-signerd       quorum-signerd
  share 1 of 3          share 2 of 3         share 3 of 3
      │                     │                     │
      └──── Noise_K over frostd (ceremony) ───────┘
      │                     │                     │
      └──────── quorum-coordinatord ──────────────┘
                     │  holds NO key material
                     │  sees commitments and signature shares — neither is secret
                     ▼
              Next.js web tier            lightwalletd
              (cannot sign, structurally)  testnet.zec.rocks:443
                     │                             │
              PostgreSQL                     Zcash testnet
              state + metadata only          Ironwood pool
```

**The coordinator cannot sign, and this is structural rather than a policy.** The contract is
split in two: `CoordinatorService` (what the browser may call) and `SignerService` (what a
signer daemon calls, with a per-participant bearer token). There is no route on the browser
surface that produces a signature, and a test fails the build if one appears.

Below the threshold, the signature **does not exist**. That is arithmetic, not a permission
check in our code — the distinction a judge will care about.

We wrote our own `frostd` client rather than using `frost-client`, which is unpublished and
pinned to `frost-core 2.2.0`; depending on it would drag a second, incompatible FROST into
the tree.

---

## 7. The security claim, stated precisely

Two sentences that sound alike and are not:

- *No party sees more than one share while signing.* — demonstrated by
  `three-signer-demo.sh`, three OS processes, one sealed share each.
- *No party ever saw more than one share.* — demonstrated by `three-party-ceremony.sh`,
  where the shares are born in three processes.

Until 25 September only the first was true. Both are now true **of the same vault**, and that
vault is the one in the 25 Sep transaction above. We spell this out because for most of this
build we could have said the second sentence and been wrong, and nothing in the product would
have contradicted us.

---

## 8. Three things we got wrong, and what they taught us

Included because they are the parts a cryptographer will recognise as real.

**A valid signature that authorizes nothing.** Our three-process demo reported *APPROVED, 2
signatures* for a transaction built by a **different vault**. Nothing was broken: signers are
handed the randomizers the transaction specifies, so every share verified and aggregation
succeeded — over a transaction the vault had no claim on. The signature was valid. It
authorized nothing, and the only place that surfaces is a node rejecting the broadcast. Each
action carries `rk`, which must equal this vault's `ak` randomized by that action's own
`alpha`; both are public, so the check is free. The coordinator now refuses a mismatch before
any signer burns a nonce.

**A vault that silently becomes three.** `ak` comes from FROST, but `nk` and `rivk` come from
a seed agreed once. A participant who sends a different seed to each peer produces three
vaults wearing one name — same group key, three addresses — and **FROST raises no objection**,
because the seed is not its business. We lost testnet funds to the single-process version of
this. The ceremony now ends with a confirmation round: everyone compares the group key and the
derived address, and nobody writes a share unless all of them match.

**A relay that quietly excludes you.** `frostd` keeps the session coordinator out of
`session.pubkeys`, so a creator who omits themselves becomes unaddressable, their receive
queue stays empty forever, and the round times out with no indication why. Our own client's
documentation had this exactly backwards. It survived because the test that would have caught
it had never been run against a real server.

---

## 9. Honest security posture — what this is not

Per [06-risk-register.md](06-risk-register.md) R6. Default to understatement; when unsure
whether something is audited, say we are unsure.

> **Quorum is a testnet prototype. It is not ready for mainnet, and it must not hold real
> funds.**

- **Not audited.** `frost-core` was audited by NCC Group. **`frost-rerandomized` was not
  covered by that audit** and still carries an API-may-change warning. Our orchestration layer
  — the coordinator, the daemons, the share-at-rest format — has had no external review of any
  kind.
- **ZIP-312 is still Draft.** The Zcash Foundation's 2026 roadmap says it is being finalised.
- **We depend on an unmerged upstream patch.** Deriving a vault's viewing key from a group key
  nobody holds the spending key for needs a constructor that is not in the published `orchard`
  crate; it comes from [zcash/orchard#475](https://github.com/zcash/orchard/pull/475), still
  open. **That constructor is named for being incompatible with quantum recoverability** —
  which is the property Ironwood exists to provide. Whether a FROST vault can therefore live
  properly in Ironwood long-term is **an open question we have raised and cannot answer
  ourselves.** `zcash-sign` has the same dependency.
- **Quantum:** ZIP-2005 gives quantum *recoverability*, not quantum resistance. RedPallas
  signatures remain vulnerable to Shor's algorithm. See the point above for why our use is
  additionally uncertain.
- **Release candidates.** Pinned to `pczt 0.8.0-rc.1` and `zcash_client_backend 0.24.0-rc.1`.
- **The signers do not see what they are signing, and this is the most serious limitation
  here.** `quorum-signerd` receives a sighash and a set of randomizers from the coordinator and
  signs them. It never sees the transaction. So a compromised coordinator can serve the
  sighash of a *different* transaction spending the same vault, collect a valid threshold
  signature over it, and move the funds — the signers have no way to notice. The coordinator
  checks that a transaction belongs to the vault before accepting it, but that check runs on
  the coordinator, which is precisely the party it would need to defend against.
  **This means the coordinator is currently trusted for *what* gets signed, even though it is
  genuinely untrusted for key material.** The fix is for signers to derive the sighash from
  the transaction themselves and show a human what it pays; it is specified and not yet built.
- **There is no human approval step.** The signer daemon polls and signs. Nothing prompts the
  participant, which means the "2-of-3 approval" is 2-of-3 machines consenting automatically
  rather than two people deciding. The threshold arithmetic is real; the governance around it
  is not yet.
- **Authentication is a floor, not a ceiling.** Signer routes use per-participant bearer
  tokens. Participants already hold XEdDSA identities for `frostd`; challenge-response against
  those keys is the production answer and is not built.
- **The web signing flow is simulated unless `COORDINATOR_URL` is set.** The interface says so
  on screen, and those labels stay.
- **No reminders.** A signer who has not answered is tracked but not chased.
- **The last mile is hand-run.** Aggregation produces an authorized transaction; proving and
  broadcasting it are `zcash-devtool` commands a human runs. Both confirmed spends above went
  out that way. `/api/broadcast` exists and is not wired to the coordinator's authorized-
  transaction route.
- **Not built, deliberately:** signer rotation and share repair (the libraries support both),
  hardware or air-gapped signers, mainnet, and any quorum policy beyond a fixed threshold.

---

## 10. Traction

<!-- DEV B: this is the one judging criterion that cannot be earned by coding. See
     docs/09-traction.md and docs/14-traction-kickoff.md. Needed:
       - letters of intent, with names the judges recognise
       - the forum thread, with link and any substantive replies
       - who has actually looked at this and what they said, quoted
     If there is nothing yet, say so here rather than padding it. An empty section
     read as honest beats a full one read as filler. -->

---

## 11. Business model, briefly

We are explicitly non-custodial, so basis points on assets under custody — the standard
custody model — is not available to us and we would not want it. The model is **per-seat
governance software**: an organisation pays for the coordination layer, the audit trail and
the support, not for us holding anything. That is a smaller number per customer and a
defensible one.

<!-- DEV B: sharpen if you have a better answer. Judges ask. -->

---

## 12. Team

- **Dev A — protocol.** FROST-RedPallas, distributed key generation over `frostd`, PCZT
  assembly and spend authorization, share encryption at rest, the coordinator state machine.
- **Dev B — product and infrastructure.** Web architecture, lightwalletd integration, database
  and migrations, the audit export, testnet operations, and the video.

Both of us come from security audit and GRC work, which is where the viewing-key audit trail
came from. It is not a feature a cryptographer thinks of first; it is the feature the person
who has sat through the audit thinks of first.

---

## 13. Run it yourself

```bash
git clone https://github.com/Fatihmaull/zcash-multisig && cd zcash-multisig
cargo build --release --manifest-path packages/core/Cargo.toml --bins

# a key ceremony in three processes, over a real frostd
./scripts/three-party-ceremony.sh ./secrets/ceremony

# three signers, one sealed share each; the coordinator holds none
./scripts/three-signer-demo.sh ./secrets/ceremony <pczt>

# the misbehaving-signer path
SIGNERS="Bob Carol" MISBEHAVE=Bob ./scripts/three-signer-demo.sh ./secrets/ceremony <pczt>
```

Full sequence, including funding and broadcast: [docs/16-runbook.md](16-runbook.md).
