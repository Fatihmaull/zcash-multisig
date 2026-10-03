# 17 — Outreach drafts, ready to send

**P4-5.** Send these yourself. Nothing here has been sent, and nothing here should be sent
by anyone who hasn't read it first.

The samples in [09-traction.md](09-traction.md) were written before Gate B, back when we
had nothing to show, so they open with a plan. We have three confirmed threshold-signed
shielded spends on testnet now, and a message that opens with proof gets answered at a
very different rate than one that opens with an intention.

> **Check anything you edit against [06-risk-register.md](06-risk-register.md) R6.**
> No "audited". No "secure". No "production-ready". No "quantum-resistant". No user
> counts, and interest is not adoption. With this audience, understatement buys
> credibility and overstatement spends it permanently.
>
> Every draft below is written to that standard. If you change one, check it again.

## Facts you can use freely

All verified 3 October 2026.

- Three 2-of-3 threshold-signed shielded **Ironwood** spends confirmed on Zcash testnet.
  The two that carry the custody claim are
  `259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61` (block 4,390,493)
  and `bcaba4235fc9b63b93ff706c099a61a7abee916bd697a614de45d98ff8489454`
  (block 4,400,816). Both come from a vault whose three key shares were generated in
  three separate processes and were never in the same place.
- `0ef1e96411b770fb0aec7d35c820510cd303f696126ac85782158c75382681ce` (block 4,383,363)
  is older. Its vault came from a single-process fixture, so it proves the spend path and
  nothing about custody. Keep them apart.
- Testnet only. No mainnet funds have ever touched this build.
- Not audited, in any part. `frost-core` is, by NCC Group. `frost-rerandomized` is not,
  and our own layer has had no external review of any kind.
- We asked the Zcash Foundation what the current viewing-key derivation costs, in
  [frost#1094](https://github.com/ZcashFoundation/frost/issues/1094), and the answer was
  that it gives up quantum recoverability. That's public, so don't soften it anywhere.
- 50 tests. Repo is public: https://github.com/Fatihmaull/zcash-multisig

## Who to write to

**Don't guess at names.** Pull the current list rather than working from memory.

| Segment | Where to find current names |
|---|---|
| ZCG grantees | The Zcash Community Grants committee's published grant list and its forum category |
| Zcash Foundation | Their published contact address, or the ZF people already active in the FROST repos |
| Wallet teams | The maintainers listed on each wallet's own repository |
| Educators | ZecHub's published contact routes |

Write to a person where you can and a published team address otherwise. Five well-aimed
messages beat twenty.

---

## 1 — The forum thread

**Post this first.** It doesn't need anyone to reply to start counting as dated evidence,
and it reaches the people in sections 2 through 4 at the same time without feeling like
you approached each of them individually.

> **Title:** Shared custody for shielded ZEC: three 2-of-3 threshold spends on Ironwood testnet
>
> Organisations holding shielded ZEC pick between two bad options today. Put the funds in
> a transparent address and every vendor payment and salary is public forever, or put them
> in a shielded address behind one seed phrase and one person is the whole control. The
> second one isn't something you can show an auditor.
>
> I've been building the layer in between for the Crypto World's Fair Zcash track. Not the
> cryptography, which is the Foundation's and is already good. Not the transport, which is
> `frostd`. The organisational part: a key ceremony someone non-technical can finish,
> signer coordination, misbehaving signer detection that names the person, and an audit
> export derived from the vault's viewing key so a funder can check your spending without
> trusting you or me.
>
> **Three 2-of-3 threshold-signed shielded Ironwood spends are confirmed on testnet.**
>
> ```
> 259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61   block 4,390,493
> bcaba4235fc9b63b93ff706c099a61a7abee916bd697a614de45d98ff8489454   block 4,400,816
> 0ef1e96411b770fb0aec7d35c820510cd303f696126ac85782158c75382681ce   block 4,383,363
> ```
>
> The first two come from a vault whose three key shares were generated in three separate
> processes and were never in the same place, so the claim covers key generation and not
> only signing. The third one is older and its vault came from a single-process fixture,
> so it proves the spend path and nothing about custody. Worth keeping those apart.
>
> **Why this is possible now.** In v6 the shielded anchor is authorizing data, chosen at
> broadcast instead of at build time. Under the older format, signer one approving in the
> morning and signer two opening their laptop in the afternoon meant a stale anchor, a
> rebuilt transaction, and every signature already collected thrown away. A 2-of-3 group
> spread across time zones couldn't close a round. That's the specific reason a usable
> shielded multisig works now and didn't a year ago.
>
> **Two things I got wrong, since those are more useful than the parts that worked.**
>
> The signers were signing blind. The coordinator handed them a sighash and they signed
> it, so a compromised coordinator could have served the sighash of a different
> transaction spending the same vault and collected a valid threshold signature over it.
> Every share would have verified. Nobody could have noticed. They now derive the sighash
> from the transaction themselves and check each action's `rk` against their own group key.
>
> And a vault can silently become three. `ak` comes from FROST but `nk` and `rivk` come
> from a seed the members agree on, so a participant who sends a different seed to each
> peer produces one group key and three addresses. FROST raises no objection, because the
> seed isn't its business. Everyone ends up holding a valid share of a different vault.
> The ceremony now ends with everyone comparing the derived address and nobody writing a
> share unless they match.
>
> **What this is not.** Testnet only. Not audited in any part: `frost-core` is audited by
> NCC Group, `frost-rerandomized` is not, and my own orchestration has had no external
> review of any kind. ZIP-312 is still Draft.
>
> And one I'd rather state than bury. Deriving a vault's viewing key currently uses
> `from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed`, from an
> unmerged orchard PR. I asked the Foundation what that costs
> ([frost#1094](https://github.com/ZcashFoundation/frost/issues/1094)) and the answer was
> that you give up quantum recoverability and would need to migrate later. So vaults built
> with this today lose the property Ironwood exists for. The right path is ZIP-2005
> §4.2.3, another integrator on that thread already does it that way, and it's the first
> thing I do after submitting rather than something I rush three days before a deadline.
>
> **I'm not the only one here, and pretending otherwise would be strange.** Konclave has a
> group vault on Zcash with FROST and nineteen verifiable mainnet transactions, which is
> further than I've got, and their thread in this category is worth reading for the
> correction log alone. Zafe is building a mobile shielded multisig on Ironwood on the same
> crates I'm using, and their viewing key derivation is more correct than mine, which I
> only know because I read their comment on a Foundation issue. I think what I'm building
> sits above a wallet rather than being one, but I'd rather say that out loud and be
> corrected than act like I hadn't noticed them.
>
> Code: https://github.com/Fatihmaull/zcash-multisig
>
> I'd genuinely value being told where this is wrong. The parts I'm least sure about are
> the ceremony's trust assumptions, whether the audit export is actually useful to anyone
> who has had to satisfy a funder, and whether the line I'm drawing between a vault and a
> governance layer is a real one or just the shape of what I happened to build.

**Four choices in there worth keeping.** The two mistakes sit in the middle rather than
buried at the end, because for this audience that's the most interesting thing we have and
the only part nobody could write without having built it. The unfavourable answer from the
Foundation is quoted in full with a link, because hiding it on the same forum where that
thread is searchable isn't a risk worth taking. There's no ask at all: a thread that wants
something reads as promotion, a thread that wants criticism gets replies.

And the other two projects are named, with what each does better than us. On a forum where
both are already posting, not mentioning them reads as either not having looked or hoping
nobody else did. Naming them costs a paragraph and buys the only thing we're actually
asking for, which is to be taken seriously enough to be argued with. The closing line
extends the same offer to our own positioning, since "governance layer, not a wallet" is a
distinction we drew ourselves and it deserves to be tested by people who have shipped
further.

---

## 2 — ZCG grantees

The most reachable group, and the half of the problem nobody else is solving for them.

> **Subject:** Shielded ZEC with shared control, and proving to ZCG where it went
>
> Hi [name],
>
> You hold grant funds in ZEC. If they're shielded, I suspect you've had to choose between
> shared control and privacy, and then separately had to satisfy a funder about where the
> money went.
>
> I've been building a 2-of-3 threshold custody layer for shielded funds for the Crypto
> World's Fair Zcash track. The part I think matters for you isn't the threshold signing,
> it's the audit trail. It comes from the vault's viewing key rather than from our
> database, so you hand a funder the viewing key and they verify your spending against the
> chain without trusting us or you.
>
> It's testnet only and not audited, and I'm not asking you to use anything.
>
> What I'd value is a blunt answer to one question. **Is that a real problem for you, or
> have you already solved it some other way?** If it's real and you'd consider something
> like this once it's been reviewed properly, I'd like to say so in the submission,
> quoting you, with your permission and in your words.
>
> Happy to show you it working in ten minutes, or to just take the reply.
>
> [your name]

---

## 3 — Wallet teams

They won't write you an endorsement. They'll write a sharp technical critique, and a named
maintainer's critique with your response to it is better evidence than a bland letter.

> **Subject:** Shielded threshold custody on Ironwood: where does this break for real users?
>
> Hi [name],
>
> You've dealt with shielded UX in anger and I haven't, so I'd rather hear where this falls
> over from you than find out in front of judges.
>
> I've built a 2-of-3 threshold custody layer over re-randomized FROST, targeting Ironwood.
> Three spends confirmed on testnet. The thing that makes it usable is that in v6 the
> shielded anchor is authorizing data, chosen at broadcast after signatures are collected,
> so one signer approving at 09:00 and another at 16:00 no longer invalidates the round.
> That was the failure mode keeping this a research demo rather than a product.
>
> Two things I got wrong, in case they're interesting.
>
> Signers were signing a sighash the coordinator handed them, so a compromised coordinator
> could have collected a valid threshold signature over a transaction nobody saw. They now
> derive it from the transaction and check it spends from their own vault.
>
> And a participant who sends a different vault seed to each peer produces one group key
> and several addresses. FROST raises no objection. Everyone holds a valid share of a
> different vault, and funds sent to the wrong address can't be spent by any quorum.
>
> Where does this break for the people you support? I'd rather have the criticism than the
> compliment.
>
> [your name]

Leading with the mistakes is disarming, it's true, and to this audience it's the most
credible thing in the message.

---

## 4 — Educators, ZecHub and similar

Lowest cost to them, useful distribution to us.

> **Subject:** Worth documenting? Shared custody for organisations holding shielded ZEC
>
> Hi [name],
>
> Organisations holding shielded ZEC have no way to express shared control, since there's
> no multisig in the shielded pools, so they pick a transparent address or one person with
> the seed. I've built a 2-of-3 threshold layer over the Foundation's FROST work for the
> Crypto World's Fair Zcash track. Three spends confirmed on testnet, testnet only, not
> audited.
>
> Regardless of what happens to my project: **is "how an organisation can hold shielded ZEC
> under shared control" worth a page in ZecHub?** If so I'm happy to write the neutral
> version, covering the Foundation's FROST tooling and anything else in the space rather
> than just mine.
>
> [your name]

---

## 5 — Following up, once, after four days

One follow-up. Not two.

> Hi [name], following up once in case this got buried. No reply needed if it isn't of
> interest, and I won't chase it again.
>
> The one thing I'd still value is a yes or no on whether [the problem] is real for you.
> Even a one-line no is useful, since I'd rather drop a wrong assumption than carry it into
> a submission.
>
> [your name]

---

## 6 — Permission to quote

**Don't skip this.** An LOI you can't attribute isn't evidence. The moment someone says
something useful, ask:

> That's genuinely helpful, thank you.
>
> May I quote that in the hackathon submission, attributed to you and [organisation]? I'll
> send you the exact sentence and the surrounding context first, and I'll drop it if you'd
> rather not, or use it unattributed as "a ZCG grantee" if that's easier.
>
> [your name]

Then actually send them the sentence. Quoting someone in a way they haven't seen is how a
supporter turns into a public correction.

---

## What goes in the submission

[09-traction.md](09-traction.md) has the rule and it's the one to hold: write the truth,
precisely. Named organisations and their verbatim reactions. LOIs quoted with attribution
and permission. The forum thread, with dates. No user count, and interest is not adoption.

If there's nothing by 8 October, §10 of the submission says there's nothing and why. That's
a worse section and a better submission. A judge in a field of 50 to 100 who catches one
inflated traction claim discounts everything else.
