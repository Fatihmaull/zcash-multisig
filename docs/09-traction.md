# 09 — Traction

**Owner: B. Starts week 1, not week 4.**

---

## The problem

Colosseum judges on *demonstrated user traction or revenue*. Our users — foundation treasurers,
ETPs, custodians — are enterprise sales cycles measured in months. We will have **zero users**
on 12 October. No amount of coding changes this.

Two consequences, and it is worth being clear-eyed about both:

- **The general pool is out of reach.** Top 23 overall, judged heavily on traction, against
  thousands of entries. We are entered automatically; treat any result there as a lottery win
  and never trade away track position for it.
- **The track is winnable anyway.** 10 slots against Colosseum's own expectation of 50–100
  submissions. Top ~15% of a small specialised field, judged partly by Zcash ecosystem people —
  Colosseum asked ZCG for a dedicated Zcash-side point of contact for judging. In that room,
  **ecosystem credibility substitutes for user count.**

## The substitute: letters of intent

Three to five recognisable Zcash-ecosystem names saying on record that they would use this.

A judge who knows the ecosystem reads a named ZCG grantee or wallet maintainer saying "we would
use this for our grant reporting" as more meaningful than fifteen anonymous signups. It is also
the only form of validation actually obtainable in 26 days.

**Lead time is weeks, not days.** Someone contacted on 8 October replies after the deadline.
This is why it starts in week 1 and why it is a named person's job.

## Who to contact

| Who | Why them | Ask |
|---|---|---|
| **ZCG grantees** | Feel both halves of the problem — shared control *and* proving to a funder where money went. Most reachable segment. | Would you use shared custody with a verifiable audit export for your grant reporting? |
| **Zcash Foundation** | Their roadmap names FROST and DKG. **Approach as collaborators, never as competitors** — see [08-prior-art.md](08-prior-art.md). | Is the organisational layer above FROST something you see a need for and do not plan to build? |
| **Wallet teams** (Zingo, Nighthawk, similar) | Know exactly where shielded UX breaks. Sharpest technical feedback available. | Where does this break for real users? |
| **ZecHub / community educators** | Distribution and credibility. Low cost to them. | Would this be worth documenting for organisations holding ZEC? |
| **Zcash Community Forum** | Public build thread — visible to judges, and generates feedback that doubles as evidence | Post the problem framing and the v6 anchor insight; invite critique |

## Priority first contact — the Zcash Foundation, today

Spike S1 produced a question only ZF can answer, and it is close to an ideal opening: specific,
informed, and about work they own. It advances the build **and** opens the relationship.

> Subject: FROST vault FVK derivation under Ironwood — intended path?
>
> Hi,
>
> I'm building a shared-custody layer over re-randomized FROST for the Crypto World's Fair
> Zcash track, targeting the Ironwood pool.
>
> Working through `zcash-sign`, I see the vault's Orchard full viewing key is derived with
> `FullViewingKey::from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed()`,
> which lives in the fork behind zcash/orchard#475 rather than the published crate.
>
> Two questions:
>
> 1. Now that constructor is marked for removal, what is the intended FVK derivation for a
>    FROST-controlled vault?
> 2. Does using it forfeit Ironwood's quantum recoverability for funds in that vault, or does
>    it only affect key recovery while spend authorization is unaffected?
>
> I'd rather ask than guess — it's a custody tool, and I don't want to overstate what it
> guarantees.
>
> [name]

Asking rather than guessing is the point, and it is worth saying out loud: it signals the kind
of team worth funding. Full context in [12-spike-s1-report.md](12-spike-s1-report.md) §7.

## How to ask

**Ask for a reaction, not a favour.** "Would you use this?" gets a considered answer and
sometimes a quotable one. "Can you endorse us?" gets silence.

Keep it short. Lead with the problem, not the product. Include one concrete artifact — the
problem framing, or a 60-second clip once something works. Never send a wall of text about the
architecture.

Sample:

> Subject: Shared custody for shielded ZEC — does this match a problem you have?
>
> Hi [name],
>
> I'm building a shared-custody layer for Zcash shielded funds for the Crypto World's Fair
> Zcash track — 2-of-3 threshold control using the Foundation's FROST work, with an audit
> export derived from the vault's viewing key so a grant funder can verify spending
> independently.
>
> The premise is that organisations holding shielded ZEC currently choose between a transparent
> address and one person holding the seed, and that the second one isn't a control you can put
> in front of an auditor.
>
> Does that match a problem you actually have? I'd value ten minutes, or just a blunt reply
> telling me it isn't real.
>
> [name]

That last line matters. It invites an honest no, which is worth more than a polite maybe — and
people answer messages that do not try to trap them.

## Public build log

Post progress to the Zcash Community Forum and X, 2–3 times a week from week 1.

- Judges see it, and it is dated evidence of how the project developed.
- It attracts exactly the feedback we need from exactly the right people.
- It generates quotable reactions that become the traction evidence.

Post the v6 deferrable-anchor insight early. It is genuinely interesting to this audience, and
being the team that noticed it publicly is worth more than keeping it for the video.

**Every public post is an external claim** — it goes through the R6 review in
[06-risk-register.md](06-risk-register.md). No "audited", no "secure", no
"production-ready", no "quantum-resistant". In front of this audience, understatement buys
credibility and overstatement spends it permanently.

## What goes in the submission

Under traction, write the truth, precisely:

- Named organisations that reviewed the problem framing and their verbatim reactions.
- Letters of intent, quoted with attribution and permission.
- The public build log, with dates.
- Any testnet usage by people outside the team.

Do not invent a user count. Do not describe interest as adoption. A judge who catches one
inflated traction claim discounts the entire submission, and in a field of 50–100 that is
fatal.

## Checkpoints

| Date | Target |
|---|---|
| 22 Sep | 10 contacts made, build log live, forum thread posted |
| 29 Sep | 3+ substantive replies, first LOI conversation opened |
| 6 Oct | 3–5 LOIs or quotable reactions secured, with permission to quote |
| 10 Oct | Traction section written into the submission |
