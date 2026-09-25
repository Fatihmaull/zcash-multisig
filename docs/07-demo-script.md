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
| 7. Honest close | 2:55–3:15 | Credibility |

Beat 7 was budgeted at five seconds for a paragraph that takes about eighteen to say. The
table now reflects the paragraph rather than the reverse — total lands near **3:10**,
comfortably under the 4:00 ceiling. Do not cut the honest close to protect a round number.

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

**Film the terminals, not the wizard.**

An earlier version of this script said to record "a 2-of-3 DKG through the web UI". The web
ceremony is a **wizard over a simulation** — it explains the flow, it does not perform it.
Recording it as the ceremony would be the one dishonest frame in the video, and it would also
throw away our strongest visual.

Run the real thing:

```bash
./scripts/three-party-ceremony.sh ./secrets/ceremony
```

Three terminals side by side. Each prints one share path and the same vault address:

```
Alice  pid 76968  → ./secrets/ceremony/alice/share-1.bin
Bob    pid 76974  → ./secrets/ceremony/bob/share-2.bin
Carol  pid 76979  → ./secrets/ceremony/carol/share-3.bin
```

Three processes. One share each. The same address from all three, which is the confirmation
round agreeing rather than us asserting.

> "These are three separate processes on three machines. Each one generates exactly one share
> and never sends it anywhere — what crosses the network is encrypted to one named recipient.
> Nobody in this ceremony, including us, ever holds the full spending key. Not while signing,
> and not while it was being created."

That last clause is the whole claim and it is nine days old. Say it deliberately.

The web wizard can still appear — as the thing a treasurer is guided by — but it must be
introduced as the interface, with the terminals shown as what is underneath. **If it appears
unlabelled, cut it.**

## Beat 4 — Approval and the spend *(1:20–2:00)*

**The proof beat.** Everything else is a claim; this is evidence.

Proposer creates an approval request for a shielded Ironwood spend. Two of three approve. The
transaction confirms on testnet.

```
txid   259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61
block  4,390,493
```

Say "testnet" out loud, and put it on screen.

**Prove it with the viewing key, not an explorer.** A block explorer can confirm a shielded
transaction exists and nothing else — which is the point of a shielded transaction, and a
judge will notice that the explorer screenshot shows them nothing. Sync the watch-only wallet
built from the vault's own viewing key and show the transaction appearing with its amount:

```bash
zcash-devtool wallet -w ./secrets/ceremony-watch sync
zcash-devtool wallet -w ./secrets/ceremony-watch list-tx
```

That is also beat 6 arriving early, which is fine — it lets beat 6 be short.

### Two things that look like bugs on camera

**The third signer stays `PENDING`.** Threshold is two, so whichever pair answers first wins
and the third never gets asked. Correct, and it reads as a hang if unexplained. One sentence:
*"Carol was never needed — two was the threshold, and the round closed without her."*

**Proving takes long enough to notice.** Do it between takes. It needs no authority and
nothing about it is interesting to watch.

## Beat 5 — When a signer misbehaves *(2:00–2:35)*

The beat that separates us from a UI wrapper over a CLI.

Second run, one signer returns a corrupted share.

**Name the pair, or the beat may not happen.** With three signers online and a threshold of
two, the honest pair can finish before the culprit is asked for anything:

```bash
SIGNERS="Bob Carol" MISBEHAVE=Bob \
  ./scripts/three-signer-demo.sh ./secrets/ceremony <pczt>
```

```
REJECTED 2  Alice=PENDING  Bob=INVALID_SHARE  Carol=APPROVED
⚠ Bob  SIGNATURE_SHARE  INVALID
```

Show the UI response:

> **Signature share rejected — Bob.** The share does not verify against the commitment made in
> round 1. This vault has not been charged and no funds moved. Re-run the round without this
> signer, or investigate the device.

That is the message the coordinator actually emits, verbatim. **Use the fixture names —
Alice, Bob, Carol** — everywhere on screen and in narration; an earlier draft of this script
used a different name and a mismatch between the slide and the terminal is the kind of thing
a careful viewer spots and a careless one is confused by.

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

## Beat 7 — Honest close *(2:55–3:15)*

Credibility, in front of an audience of cryptographers, is worth more than a strong claim.

> "To be clear about what this is: `frost-core` is audited, but rerandomized FROST is not
> covered by that audit and ZIP-312 is still a draft. This is testnet only. We didn't build the
> cryptography — the Zcash Foundation did. We built the layer that lets an organisation
> actually use it."

**If there is room, add the open question.** It is the most credible sentence available to
us, because it is one we cannot answer:

> "And one thing we don't know: deriving a vault's viewing key needs a constructor that is
> still an open pull request upstream, and it is named for being incompatible with quantum
> recoverability — which is the property Ironwood exists to provide. We've raised it. We
> can't resolve it ourselves."

A team that can name precisely where the ground is uncertain reads as competent. A team that
sounds certain everywhere reads as one that has not looked.

---

## Rules

**Do:**
- Label testnet, out loud and on screen.
- Show one real confirmation. One is enough; it is the whole proof.
- Name the upstream work we depend on. Judges include people who wrote it.
- Rehearse on a clean environment. Expect the first three takes to be unusable.
- **Label anything simulated, on screen, while it is on screen.** The UI already does this;
  do not crop it out. A judge who finds one unlabelled simulation stops believing the parts
  that are real, and we have a great deal that is real.

**Never:**
- Fake a confirmation or dress a stub as a working transaction.
- **Film the web ceremony wizard as if it were the ceremony.** See beat 3.
- Show a mainnet explorer for a testnet transaction.
- Say "audited", "secure", "production-ready", or "quantum-resistant".
- Describe Quorum as "FROST tooling for Zcash" — that is ZF's lane and the framing loses.
- Open with a logo animation or a market-size slide.

## Before the record button

From the P4-1 rehearsal — [16-runbook.md](16-runbook.md) has the full sequence. Three of
these cost minutes each and none of them is interesting to film.

| | |
|---|---|
| **Fund the vault an hour early** | The faucet is the long pole, not the code. Rate-limited, proof-of-work gated, occasionally down. |
| **Check the PCZT belongs to the vault** | `cargo run -p quorum-coordinator --example which_vault -- <pczt>`. The coordinator refuses a mismatch anyway, but finding out here costs a second and finding out mid-take costs a take. |
| **Prove off camera** | Slow, and needs no authority. |
| **Build `frostd` and `zcash-devtool` first** | Neither is vendored. Both are other people's tools, deliberately. |

## If Gate B was missed — *it was not; kept for the reasoning*

Gate B passed on 23 September, four days early, and all five of its criteria were met by the
25th. This section stays because the principle in its last paragraph outlives the contingency.

Had it been missed: use the degraded demo from [06-risk-register.md](06-risk-register.md) R1
and **change beat 4 honestly**. Show what does work, then state plainly what blocks the rest, citing librustzcash
#2467 and #2525 by number.

A team that can name precisely why the bleeding edge is not ready reads as competent to a Zcash
judge. A team caught overstating does not recover.
