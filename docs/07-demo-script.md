# 07 — Demo script

**Recording begins 5 October. This is a gate, not a suggestion.**

Communication is an explicit Colosseum judging criterion, and the judge's entire experience of
the product is this video. Target **3 minutes**; absolute ceiling 4.

---

## Structure

| Beat | Time | Purpose |
|---|---|---|
| 1. The control that isn't | 0:00–0:25 | Founder-market fit |
| 2. Why this was impossible | 0:25–0:50 | Unique insight |
| 3. The ceremony | 0:50–1:20 | Execution |
| 4. Approval and the spend | 1:20–2:00 | **The proof** |
| 5. When a signer misbehaves | 2:00–2:35 | Domain depth — the beat that wins the track |
| 6. What the auditor gets | 2:35–2:55 | Differentiation |
| 7. Honest close | 2:55–3:00 | Credibility |

---

## Beat 1 — The control that isn't *(0:00–0:25)*

Open with the founder story. Not the product, not the market, not a logo animation.

> "I come from GRC. I have watched organisations fail controls audits because 'the treasurer
> holds the seed phrase' is not a control — it's a key-person risk with a human wrapper.
> Zcash shielded funds currently have no way to express a control at all. There is no multisig
> opcode in the shielded pools. So an organisation either publishes every transaction on a
> transparent address, or one person holds everything. 4.89 million ZEC — about $5.8 billion —
> sits in shielded pools under exactly that constraint."

Why this opening: founder-market fit is a judging criterion and the team's GRC background is
genuinely stronger fit here than another Rust cryptographer would be. Say it in the first
sentence, where it is heard.

## Beat 2 — Why this was impossible until now *(0:25–0:50)*

Lead the technical section with the v6 anchor insight. It is the sharpest thing we know.

> "FROST threshold signatures for Zcash already exist and the Zcash Foundation has done that
> work. But threshold approval is slow by nature — signer one approves at nine, signer two
> opens their laptop at four. Under the old transaction format the anchor was fixed when the
> transaction was built, so it went stale across that gap, the transaction had to be rebuilt,
> and every signature already collected was thrown away.
>
> In the v6 format the anchor is authorizing data. It's chosen at broadcast, after signatures
> are collected. That's what makes a shielded multisig that real organisations can actually
> operate possible now, and not a year ago."

This is specific enough to prove we read the spec rather than the marketing.

## Beat 3 — The ceremony *(0:50–1:20)*

Screen recording. Three participants complete a 2-of-3 DKG through the web UI.

Show the moments that matter: what a share is, why it never gets copied to a colleague, what
happens if it is lost. Say out loud that no share and no spending key ever reaches our server.

> "Nobody in this ceremony — including us — ever holds the full spending key."

## Beat 4 — Approval and the spend *(1:20–2:00)*

**The proof beat.** Everything else is a claim; this is evidence.

Proposer creates an approval request for a shielded Ironwood spend. Two of three signers
approve. The transaction confirms on testnet. Show the confirmation.

Say "testnet" out loud. Show a testnet explorer, clearly labelled.

## Beat 5 — When a signer misbehaves *(2:00–2:35)*

The beat that separates us from a UI wrapper over a CLI.

Second run, one signer returns a corrupted share. Show the UI response:

> **Signature share rejected — Budi Santoso.** The share returned does not verify against the
> commitment made in round 1. This vault has not been charged and no funds moved. Re-run the
> round without this signer, or investigate the device.

Narrate why this matters:

> "Shared control doesn't usually fail because someone is malicious. It fails because a device
> is compromised, or a signer is on a plane, or something is quietly broken. If the answer to
> any of those is a Rust panic in a terminal, a treasurer cannot use this. Knowing what went
> wrong, what it cost, and what to do next is the product."

**Note the honest framing.** Mechanically this is surfacing `InvalidSignatureShare::culprits`
in good UI, and the judges know that. Sell the *product judgment* — recognising that this is
the failure mode that decides whether shared custody is usable — not the cryptography, which
is not ours.

## Beat 6 — What the auditor gets *(2:35–2:55)*

> "The organisation that needs 2-of-3 control also has to prove to a grant funder where the
> money went. So the audit trail isn't our event log — anyone can forge a database table. It's
> derived from the vault's viewing key. Hand the funder the viewing key and they can verify
> this export themselves, against the chain, without trusting us at all.
>
> That's the product: shielded funds with provable disclosure to the people entitled to it."

## Beat 7 — Honest close *(2:55–3:00)*

Credibility, in front of an audience of cryptographers, is worth more than a strong claim.

> "To be clear about what this is: `frost-core` is audited, but rerandomized FROST is not
> covered by that audit and ZIP-312 is still a draft. This is testnet only. We didn't build the
> cryptography — the Zcash Foundation did. We built the layer that lets an organisation
> actually use it."

---

## Rules

**Do:**
- Label testnet, out loud and on screen.
- Show one real confirmation. One is enough; it is the whole proof.
- Name the upstream work we depend on. Judges include people who wrote it.
- Rehearse on a clean environment. Expect the first three takes to be unusable.

**Never:**
- Fake a confirmation or dress a stub as a working transaction.
- Show a mainnet explorer for a testnet transaction.
- Say "audited", "secure", "production-ready", or "quantum-resistant".
- Describe Quorum as "FROST tooling for Zcash" — that is ZF's lane and the framing loses.
- Open with a logo animation or a market-size slide.

## If Gate B was missed

Use the degraded demo from [06-risk-register.md](06-risk-register.md) R1 and **change beat 4
honestly**. Show what does work, then state plainly what blocks the rest, citing librustzcash
#2467 and #2525 by number.

A team that can name precisely why the bleeding edge is not ready reads as competent to a Zcash
judge. A team caught overstating does not recover.
