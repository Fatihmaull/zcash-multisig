# 18 — Video agent master prompt

**Hand this whole file to the agent producing the demo video.** It is written to be
pasted or read in full by an agent with no access to the running product and no prior
context on this project.

Everything below was verified against the repository on **30 September 2026**.

---

## Your task

You are producing a **3-minute** demo video for **Quorum**, a shared-custody tool for
Zcash shielded funds, submitted to the Colosseum Crypto World's Fair **Zcash track**.
It is judged partly on *communication*, and the judge's entire experience of the
product is this video.

**You are not designing this video. You are executing an existing shot list inside an
existing design language, and auditing your own output against both.**

Read these completely before generating anything:

| File | What it settles |
|---|---|
| [`docs/07-demo-script.md`](07-demo-script.md) | **The beats, in order, with durations and narration.** The authority on what is shown |
| [`docs/16-runbook.md`](16-runbook.md) | The commands, in the order your hands run them, and what must be done before the record button |
| [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css) | **The design language, and the only authority on colour, radius and type.** There is no separate tokens file — the stylesheet is it |
| [`CLAUDE.md`](../CLAUDE.md) | The non-negotiable technical facts and the positioning line |
| [`docs/submission-draft.md`](submission-draft.md) §9 | Every limitation we disclose. **If §9 says we do not claim it, the video does not claim it** |

When two disagree, the higher row wins. Do not average them. Anything still ambiguous:
ask, do not decide.

---

## 🔴 The one thing that must not be got wrong

**This video makes two claims that sound identical and are not. Conflating them is a
false security claim about a custody product, to an audience of cryptographers.**

| | Claim A | Claim B |
|---|---|---|
| The sentence | *No party sees more than one share **while signing*** | *No party **ever** saw more than one share* |
| What proves it | `./scripts/three-signer-demo.sh` — three OS processes, one sealed share each | `./scripts/three-party-ceremony.sh` — the shares are **born** in three processes |
| True since | 24 Sep | 25 Sep |

Until 25 September only **A** was true. For most of this build we could have said **B**
and been wrong, and nothing in the product would have contradicted us.

**Both are now true of the same vault** — the one in txid `259242c6…3a61`. That is why
that txid leads, and why the 23 September one does not: its vault came from a
single-process development fixture, so it proves the spend path and **not** the custody
claim.

**Never put the two txids on screen as interchangeable evidence.** If both appear, each
carries which vault it belongs to.

### 🔴 You will never be sent a key share. Do not ask again.

This has already been asked once, in good faith, by someone planning beat 4.

**The answer is no, and the reason is the product.** Quorum's claim is that a key share
never leaves the machine that made it. A video of that claim, made by emailing key
shares to the person filming it, refutes the thing it is filming. It is also forbidden
outright: *no key material leaves a participant's machine, for any network, under any
framing.*

**You do not need them.** The demo script assigns beat 4 as *Dev B directs; Dev A
operates the terminals.* Whoever holds a share runs the command; you record the screen.
If that is impossible for your setup, the answer is **Dev A records beat 4 and hands
you the footage** — never that a share travels.

The same applies to the passphrase, the sealed `share-*.bin` files, the vault seed, and
any `secrets/` directory. If a plan requires one of these to move, the plan is wrong,
not the rule.

**A viewing key is different and may be sent** — see the numbers section. It reveals
history and grants no authority. That distinction is the product; do not let it blur.

### The second thing, and it is in the same family

**In any scripted run, two of the three signers auto-approve.**
`three-signer-demo.sh` sets `QUORUM_SIGNER_AUTO_APPROVE=1`, because a recording cannot
pause for a keystroke. A shot showing three signers completing, without saying so,
**implies three human decisions that did not happen.**

The demo script's beat 4 marks the disclosing sentence as **not optional**. It is:

> *"Bob and Carol are scripted here for timing — in a real round they'd each see this."*

Read it. Do not paraphrase it.

---

## The one-line test for everything you produce

> **Would this element exist if the product had not needed a video?**

If no, it is decoration. This product's entire argument is that it **proved** things
rather than asserting them — three transactions on a public chain, because a claim we
could not check is a claim we did not make. Decoration undermines the argument it is
attached to. Cut it.

A second test, for motion:

> **Did a person ask this to move?**

If no, it does not move.

---

## ⚠️ How this project differs from a minimal one — read before applying any anti-slop instinct

Many "avoid AI slop" rules say: no gradients, no grids, no glow, no shadows.

**Quorum's real design language has all four**, deliberately, and they are in
`globals.css`:

- `.bg-cypher-pattern` is a **40px × 40px grid** of `--border-subtle` hairlines under
  three radial washes — sky at 15%, violet at 85%, gold at 50%, each `0.08`–`0.12`
  alpha, fading to transparent by 45–60%
- `--card-shadow` and `--card-hover-shadow` exist, and the dark hover shadow
  **includes a gold glow**: `0 0 20px -2px rgba(244, 183, 40, 0.12)`
- Radii run to `1.5rem`

So the rule here is **not** "strip effects". It is:

> **Use exactly what the site uses, at the site's own values, and nothing beyond.**

A gold glow at `0.12` alpha on a card hover is our design language. A gold glow behind a
title card is invention. The grid at 40px under a page is ours; a grid that pulses, or
scrolls, or sits behind a talking head, is not.

**When in doubt, screenshot the running site and match it. The product is the
reference.**

---

## Hard rejections — produce none of these

### Motion

- ❌ **A number counting up from zero.** Every figure on screen is a reading taken from
  a chain or a test run. It never had the intermediate values
- ❌ Text sliding, scaling or flying in on a cut
- ❌ Parallax, scroll-jacking, a page-load choreography
- ❌ Easing with **overshoot, bounce or spring**
- ❌ **Auto-zoom that follows the cursor.** Modern recorders ship this on. It is
  movement nobody asked for and it is the single loudest recorded-demo tell
- ❌ Particles, scan lines, circuit-board motifs, rotating globes, "blockchain"
  ambience, hexagon meshes
- ❌ A loop or repeated movement behind text someone is reading
- ❌ Animating the terminal's arrival. Output appears because a command ran

### Surface

- ❌ **Window chrome added to a terminal** — a fake title bar, traffic-light dots, a
  "Terminal" label, a rounded card wrapper you drew. The content is unedited output and
  every decoration you add undoes that
- ❌ A **grey hex hairline**. Every border in this product is an alpha of the
  foreground: `rgba(15, 23, 42, 0.06 / 0.12 / 0.20)` on light,
  `rgba(255, 255, 255, 0.06 / 0.10 / 0.18)` on dark. A grey hex hairline is the most
  reliable tell of a generated design
- ❌ Any colour not in the values table below. Especially: **not `#ffffff` as a page
  ground on dark**, and **not a neutral grey** — this palette is slate-tinted throughout
- ❌ A shadow heavier than `--card-shadow`, or a glow anywhere other than a card hover
- ❌ Stock imagery, 3D renders, isometric illustrations, an abstract "security" visual
- ❌ A logo animation, a title sequence, or an outro card with a call to action

### On-screen text — every one of these is a false or forbidden claim

- ❌ Any **mainnet** reference. Testnet only, by constraint. Ironwood activated on
  mainnet, and we have never touched it
- ❌ "**Audited**" in any form. `frost-core` is audited by NCC Group;
  **`frost-rerandomized` is not**, and our own layer has had no external review of any
  kind
- ❌ "**Production-ready**", "enterprise-grade", "bank-grade", "military-grade"
- ❌ "**Quantum-resistant**" or "quantum-safe". ZIP-2005 provides quantum
  *recoverability*, not resistance
- ❌ "**Trustless**", "zero-trust", "no trust required". The coordinator is untrusted
  for key material and for what gets signed — it is still trusted for liveness, and it
  can stall a round
- ❌ **ZIP-2005 credited with anchor deferrability.** It changed note construction. The
  deferrable anchor is a property of the **v6 transaction format**. We made this mistake
  in our own draft and corrected it; do not reintroduce it
- ❌ Calling the **web ceremony wizard** the ceremony. It explains the flow; it does not
  perform it, and it cannot — a browser running DKG would be a browser holding shares
- ❌ Presenting a **block explorer** as verification of a shielded spend. It can confirm
  the transaction exists and nothing else, which is the point of a shielded transaction
- ❌ Any **balance on a vault card** unless it was read with that vault's viewing key.
  A shielded balance cannot be read from an address
- ❌ A **rounded measured number**. `0.08990000 TAZ`, not "about 0.09". Block
  `4,390,493`, not "~4.4M"
- ❌ A **fabricated figure of any kind.** If a panel has no real number, it shows no
  number
- ❌ Marketing register: "revolutionary", "seamless", "effortless", "the future of",
  "never worry about X again"

**"Non-custodial" is allowed** — it is true, it is demonstrated, and it is the
positioning. "Trustless" is not. The difference is the point.

---

## What earns movement

| Do | For |
|---|---|
| A **cut** | The default. Most transitions should be cuts |
| A dissolve at **150–250ms** | Between two shots of the same surface |
| Real terminal output **appearing at the pace the command produced it** | The output is the artefact. It does not need help |
| Three terminals **filling in the order the processes actually answered** | The race is real and the ordering carries information |
| **Holding still** | Most of the time. A shot that holds while a person reads is doing its job |

The site's own transition is `background-color 0.25s ease, color 0.25s ease` — that is
the whole of it. **Borrow that restraint.** If you need an easing curve, use
`cubic-bezier(0.4, 0, 0.2, 1)`; there is no spring in this product.

---

## Values, exactly

Taken from `apps/web/src/app/globals.css`. **The product ships dark-first — record the
UI in dark mode** unless a shot specifically contrasts the two.

### Dark — the ground for the video

```
--bg-primary    #080b11   the page. Obsidian, blue-black, NOT neutral black
--bg-secondary  #0c101a
--bg-surface    #121826
--bg-card       #0e131f
--bg-elevated   #172033

--text-primary    #f8fafc      headings and figures
--text-secondary  #94a3b8      body
--text-muted      #64748b      labels

--zcash-gold      #f4b728      the accent. One per frame
--zcash-gold-dim  rgba(244, 183, 40, 0.12)
--zcash-gold-border rgba(244, 183, 40, 0.25)

borders  rgba(255,255,255, .06 subtle / .10 default / .18 strong)
code     background rgba(0,0,0,0.4), border rgba(255,255,255,0.06)
```

### Light — if a shot needs it

```
--bg-primary #f8fafc   --bg-card #ffffff   --text-primary #0f172a
--zcash-gold #d97706   borders rgba(15,23,42, .06 / .12 / .20)
```

Gold is **`#d97706` on light and `#f4b728` on dark**. They are not interchangeable;
`#f4b728` on a white ground fails contrast and looks like a different product.

### State colours — semantic, never decorative

| State | Dark | Light | Means |
|---|---|---|---|
| success | `#10b981` | `#059669` | approved, confirmed, verified |
| warning | `#f59e0b` | `#d97706` | pending, needs attention |
| danger | `#ef4444` | `#dc2626` | invalid share, refused |
| info | `#38bdf8` | `#0284c7` | neutral status |

**Do not use gold for a state.** It is the brand accent and using it for "success"
destroys the distinction.

### Type — two faces

**Plus Jakarta Sans** for everything that is prose or interface.
**JetBrains Mono** for every cryptographic value, command, txid, address and label.

A txid in a proportional face is wrong and reads as a mock-up. Every hash, address,
block height and command in this video is monospace.

### Radius

`0.375rem` (6px) · `0.625rem` (10px) · `0.875rem` (14px) · `1.125rem` (18px) ·
`1.5rem` (24px). Cards in the product use the larger end. **Do not invent a radius
between these**, and do not put a large radius on a block of monospace output.

### One dominant element per shot

A frame where three things compete has no dominant element at all. Pick the one thing
the viewer must read, and let everything else be quieter than it.

---

## The real numbers — use these, unrounded, or none

Every figure below is measured and verifiable. **Rounding one is the fastest way to
make this look like every other submission**, and a fabricated one is the fastest way
to lose the track.

**One figure here is deliberately not final.** The transaction in beat 4 is produced on
the recording days, from the vault whose ceremony you filmed in beat 3 — it does not
exist yet and cannot. Everything else below is fixed forever.

| Figure | What it is |
|---|---|
| ⟦**SLOT** — beat 4 txid and block⟧ | Produced on the recording day. Read it off the terminal. **Do not substitute another vault's txid here** |
| `259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61` | **The lead txid for beat 2.** 2-of-3 threshold-signed shielded Ironwood spend, from the vault whose shares were never co-resident |
| **4,390,493** | The block it was mined in, 25 Sep 2026 |
| `bcaba4235fc9b63b93ff706c099a61a7abee916bd697a614de45d98ff8489454` | Same vault, 27 Sep — the run where quorum-to-chain was two commands |
| **4,400,816** | That block |
| `0ef1e96411b770fb0aec7d35c820510cd303f696126ac85782158c75382681ce` | The **first** threshold-signed Ironwood spend, 23 Sep. **Single-process fixture vault** — carries the spend claim only |
| **4,383,363** | That block |
| **0.10000000 TAZ** | What the faucet paid the ceremony vault |
| **0.01000000 TAZ** | Sent · **0.08990000 TAZ** returned as change |
| **2 of 3** | The threshold. Three participants, any two |
| **50** | Tests passing. 3 ignored — two need a live `frostd`, one needs local PCZT fixtures |
| **NU6.3** | What Ironwood formally is. **Not NU7**, which has not happened |
| **3,428,143** | Ironwood's mainnet activation block, 28 July 2026 |

Every date derived from a block height is approximate and says so.

---

## Phrases to quote rather than paraphrase

These were written carefully and each one is load-bearing.

- **"Below the threshold, the signature does not exist."** Followed by: *that is
  arithmetic, not a permission check in our code.*
- **"The event log is ours. The chain is not."** The audit export's own disclaimer
- **"This vault has not been charged and no funds moved."** The F4 message, verbatim
- **"Not while signing, and not while it was being created."** The custody claim, in
  full
- **"Bob and Carol are scripted here for timing."** Not optional. See the 🔴 block

The positioning line, which the video must not contradict:

> Not the cryptography — that exists and the Zcash Foundation wrote it. Not the
> transport, which is `frostd`. **The organisational layer in between.**

---

## Tool configuration

**Screen capture** — every enhancement **off**. Recorders ship these on, and each is on
the rejection list above:

- no auto-zoom, and specifically no cursor-activity zoom
- no webcam overlay
- no cursor highlight, ring, click effect or motion smoothing
- no wallpaper, gradient background, blur, rounded frame or shadow
- raw 1080p

**Terminal** — the real one, dark, at a legible size. Do not re-render terminal output
as motion graphics; the unedited output is the evidence and a re-typed version is not.

**Motion graphics**, if any — generate as **code** rather than a baked effect, so the
exact hex values and easing can be carried and checked. A rendered effect can only be
looked at.

**Audio** — **no music bed, no whoosh, no riser, no click, no transition sound.**
Narration is live voice-over recorded with the take. If you believe audio is needed,
ask rather than adding it. A stock music bed under a demo whose argument is measured
precision is the loudest slop signal available.

---

## Before you record — from the rehearsal

Three of these cost minutes each and none is interesting to film. All are in
`docs/16-runbook.md`.

| | |
|---|---|
| **The beat 3 vault must be funded before beat 4 is filmed** | A ceremony produces a vault with no funds, and a signer refuses a transaction that does not spend from its own vault. Film the ceremony, fund it, film the spend in a second session — the film is edited and the gap does not show. See the 🔴 block in beat 3 of the script |
| **Fund an hour early** | The faucet is the long pole, not the code. Rate-limited, proof-of-work gated, occasionally down |
| **Check the PCZT belongs to the vault** | `cargo run -p quorum-coordinator --example which_vault -- <pczt>`. A demo once ran to *APPROVED, 2 signatures* against another vault's transaction — real quorum, valid signature, authorizing nothing |
| **Prove off camera** | Slow, and it needs no authority |
| **Build `frostd` and `zcash-devtool` first** | Neither is vendored. Both are other people's tools, deliberately |

### Two things that look like bugs on camera and are not

- **The third signer stays `PENDING`.** The threshold is two, so whichever pair answers
  first wins and the third is never asked. Say so: *"Carol was never needed — two was
  the threshold, and the round closed without her."*
- **`SIGNERS="Bob Carol"` is required for the misbehaviour beat.** Without it the honest
  pair can finish before the culprit is asked for anything, and the beat silently does
  not happen.

---

## Definition of done — deliver this table filled

**A blank cell, or one that says "yes" without a method, is a failed audit.**

| # | Check | How you verified | Result |
|---|---|---|---|
| 1 | Every on-screen number appears in **The real numbers**, unrounded | list each number and where it came from | |
| 2 | Each txid on screen carries which vault it belongs to | quote the caption | |
| 3 | The two security sentences are never conflated | quote your narration | |
| 4 | The auto-approve disclosure is spoken in beat 4 | quote it | |
| 5 | No on-screen text matches the rejected-claims list | list the phrases you checked for | |
| 6 | Every colour is from the values table | list the hex values used | |
| 7 | Every hairline is an alpha of the foreground, no grey hex | list the values | |
| 8 | Gold appears as the accent only, never as a state colour | | |
| 9 | Every txid, address, block and command is JetBrains Mono | | |
| 10 | Exactly one dominant element per shot | name it, per shot | |
| 11 | No number animates from zero | | |
| 12 | No glow except a card hover at `rgba(244,183,40,0.12)` | | |
| 13 | Terminals have no added window chrome | | |
| 14 | Radius values are from the scale; none invented | list them | |
| 15 | Recorder enhancements confirmed off | list the settings | |
| 16 | No audio beyond the live narration | | |
| 17 | Shot order matches `docs/07-demo-script.md`; no invented beats | | |
| 18 | Nothing implies mainnet, an audit, or a trustless system | | |
| 19 | The web ceremony wizard is never presented as the ceremony | | |
| 20 | Anything simulated is labelled on screen while it is on screen | | |
| 21 | Beat 3's vault and beat 4's vault are the same vault | name it | |
| 22 | No key share, passphrase, seed or `secrets/` file was requested, received or stored | | |

---

## If you think a rule here is wrong

**Say so and stop. Do not route around it.**

Every rejection above is either a claim this project has already made and removed, a
constraint recorded in `CLAUDE.md`, or a limitation disclosed in the submission's §9.
Several were found the hard way: a demo that reported a quorum over another vault's
transaction, a ceremony that could silently produce three vaults, vault cards showing
one wallet's balance under every card. None of those crashed. **Every one of them would
have passed a friendly demo**, which is exactly why the rules are written down rather
than trusted to judgement under the pressure of a take.

A rule you disagree with is a message to Fatih, not a decision to make.

---

## Why this file exists

A motion designer's reflex — human or otherwise — is to animate everything in, and a
video agent's reflex is to reach for the register of a launch film.

This product's whole argument is that it proved things instead of asserting them, and
that it says plainly where it has not. A video that counts numbers up from zero, glows,
swoops and calls itself revolutionary is making the opposite argument in a different
channel, and a Zcash-track judge will hear the contradiction before they hear the
content.

**Borrow the restraint, not the enthusiasm.**
