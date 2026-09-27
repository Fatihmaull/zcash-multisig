# 17 — LOI drafts, ready to send

**P4-5.** Send these yourself — nothing here has been sent, and nothing here should be sent by
anyone but a human who has read it.

The samples in [09-traction.md](09-traction.md) were written before Gate B, when we had nothing
to show. We now have three confirmed threshold-signed shielded spends on testnet, which changes
what these letters can honestly open with — and a mail that opens with proof gets answered at a
different rate than one that opens with a plan.

> **Before sending anything, check it against [06-risk-register.md](06-risk-register.md) R6.**
> No "audited". No "secure". No "production-ready". No "quantum-resistant". No user counts, and
> interest is not adoption. In front of this audience understatement buys credibility and
> overstatement spends it permanently.
>
> Every draft below has been written to that standard. If you edit one, re-check it.

## Where we actually are, for your own reference

Facts you can use freely; all verified 27 Sep.

- Three 2-of-3 threshold-signed shielded **Ironwood** spends confirmed on Zcash testnet. The
  strongest is `259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61`, block
  4,390,493 — from a vault whose three key shares were generated in three separate processes
  and were never in the same place.
- Testnet only. No mainnet funds, ever.
- Not audited, in any part. `frost-core` is; `frost-rerandomized` is not, and our own layer has
  had no external review.
- 50 tests. Repo is public: https://github.com/Fatihmaull/zcash-multisig

## Who to write to

**Do not guess at names.** Pull the current list rather than working from memory:

| Segment | Where to find current names |
|---|---|
| ZCG grantees | The Zcash Community Grants committee's published grant list and its forum category |
| Zcash Foundation | Their published contact address, or the ZF people already active in the FROST repos |
| Wallet teams | The maintainers listed on each wallet's own repository |
| Educators | ZecHub's published contact routes |

Write to a person where you can, and to a published team address otherwise. Five well-aimed
mails beat twenty.

---

## 1 — Zcash Foundation · send this first

The best opening we have, because it is a real question about work they own, and because we
have now shipped against it rather than only read about it.

> **Subject:** FROST vault FVK derivation under Ironwood — what is the intended path?
>
> Hi,
>
> I've been building a shared-custody layer over re-randomized FROST for the Crypto World's
> Fair Zcash track, targeting Ironwood. It works — three 2-of-3 threshold-signed shielded
> spends confirmed on testnet, the strongest being `259242c6…3a61` in block 4,390,493, from a
> vault whose shares were generated in three separate processes.
>
> Getting there left me with one question I don't think I can answer myself.
>
> A FROST vault's Orchard full viewing key has to be derived from a group key nobody holds the
> spending key for. The only constructor for that is
> `FullViewingKey::from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed()`,
> which lives in the fork behind zcash/orchard#475 rather than the published crate. `zcash-sign`
> depends on it too.
>
> 1. With that constructor marked for removal, what is the intended FVK derivation for a
>    FROST-controlled vault?
> 2. Does using it forfeit Ironwood's quantum recoverability for funds in that vault, or does it
>    affect key recovery only, leaving spend authorization unaffected?
>
> I'd rather ask than guess. It's a custody tool and I don't want to overstate what it
> guarantees — the submission currently says this is an open question we raised and cannot
> resolve ourselves, which I'd like to be able to make more precise.
>
> Separately, and with no expectation: your roadmap names FROST and DKG, and what I've built
> sits above both rather than beside them — the organisational layer, not the cryptography. If
> that's a gap you see and don't plan to fill, I'd value knowing. If it isn't, I'd value knowing
> that too.
>
> [your name]

**Why this shape.** It asks about their work, gives them something they may not know a
downstream user hit, and separates the technical question from the positioning question so
neither is hostage to the other. The last line invites a no.

---

## 2 — ZCG grantees · the audit-export angle

This is the most reachable segment, and the half of the problem nobody else is solving for them.

> **Subject:** Shielded ZEC with shared control — and proving to ZCG where it went
>
> Hi [name],
>
> You hold grant funds in ZEC. If they're in a shielded address, I suspect you've had to choose
> between shared control and privacy, and then separately had to satisfy a funder about where
> the money went.
>
> I've been building a 2-of-3 threshold custody layer for shielded funds for the Crypto World's
> Fair Zcash track. The part I think matters for you isn't the threshold signing — it's the
> audit trail. It's derived from the vault's viewing key, not from our database, so you hand a
> funder the viewing key and they verify your spending against the chain without trusting us or
> you.
>
> It's testnet only and not audited, and I'm not asking you to use anything.
>
> What I'd value is a blunt answer to one question: **is that a real problem for you, or have
> you already solved it some other way?** If it's real and you'd consider using something like
> this once it's been reviewed properly, I'd like to say so in the submission — quoting you, with
> your permission and in your words.
>
> Happy to show you the thing working in ten minutes, or to just take the reply.
>
> [your name]

---

## 3 — Wallet teams · ask them to break it

They will not write you an endorsement. They will write you a sharp technical critique, and a
named maintainer's critique with your response to it is better traction evidence than a bland
letter.

> **Subject:** Shielded threshold custody on Ironwood — where does this break for real users?
>
> Hi [name],
>
> You've dealt with shielded UX in anger and I haven't, so I'd rather hear where this falls over
> from you than find out in front of judges.
>
> I've built a 2-of-3 threshold custody layer over re-randomized FROST, targeting Ironwood.
> Three spends confirmed on testnet. The thing that makes it usable is that in v6 the shielded
> anchor is authorizing data — it's chosen at broadcast, after signatures are collected — so one
> signer approving at 09:00 and another at 16:00 no longer invalidates the round. That was the
> failure mode that made this a research demo rather than a product.
>
> Two things I got wrong, in case they're interesting:
>
> - Signers were signing a sighash the coordinator handed them, so a compromised coordinator
>   could have collected a valid threshold signature over a transaction nobody saw. They now
>   derive it from the transaction and check it spends from their own vault.
> - A participant who sends a different vault seed to each peer produces one group key and
>   several addresses. FROST raises no objection. Everyone holds a valid share of a different
>   vault, and funds sent to the wrong address are unspendable by any quorum.
>
> Where does this break for the people you support? I'd rather have the criticism than the
> compliment.
>
> [your name]

**Why lead with the mistakes.** It is disarming, it is true, and to this audience it is the
most credible thing in the mail.

---

## 4 — Educators · ZecHub and similar

Lowest cost to them, useful distribution to us.

> **Subject:** Worth documenting? Shared custody for organisations holding shielded ZEC
>
> Hi [name],
>
> Organisations holding shielded ZEC have no way to express shared control — no multisig in the
> shielded pools — so they pick a transparent address or one person with the seed. I've built a
> 2-of-3 threshold layer over the Foundation's FROST work for the Crypto World's Fair Zcash
> track; three spends confirmed on testnet, testnet only, not audited.
>
> Regardless of what happens to my project: **is "how an organisation can hold shielded ZEC
> under shared control" something worth a page in ZecHub?** If so I'm happy to write the
> neutral version — covering the Foundation's FROST tooling and anything else in the space, not
> just mine.
>
> [your name]

---

## 5 — Forum thread · post today

The 22 Sep checkpoint for this was missed. It is still worth posting, and a dated thread is
evidence of how the project developed.

> **Title:** Shared custody for shielded ZEC — three 2-of-3 threshold spends on Ironwood testnet
>
> Organisations holding shielded ZEC currently choose between a transparent address, where
> every payment is public forever, and one person holding the seed. The second isn't a control
> you can put in front of an auditor.
>
> I've been building the organisational layer above re-randomized FROST for the Crypto World's
> Fair Zcash track — not the cryptography, which is the Foundation's, and not the transport,
> which is `frostd`. The part in between: a guided ceremony, signer coordination, misbehaving-
> signer attribution, and an audit export derived from the vault's viewing key.
>
> Three 2-of-3 threshold-signed shielded Ironwood spends are confirmed on testnet. The one that
> matters is `259242c6…3a61`, block 4,390,493 — its three key shares were generated in three
> separate processes and were never in the same place, so the custody claim covers key
> generation and not only signing.
>
> **Why now:** in v6 the shielded anchor is authorizing data, chosen at broadcast rather than at
> build time. Under the older format, one signer approving in the morning and another in the
> afternoon meant a stale anchor, a rebuilt transaction, and every signature already collected
> thrown away. That is the specific reason a usable shielded multisig is possible now and was
> not a year ago.
>
> **What this is not:** testnet only, and not audited in any part. `frost-core` is audited;
> `frost-rerandomized` is not, and our own orchestration has had no external review. ZIP-312 is
> still Draft. Deriving a vault's viewing key needs a constructor from an unmerged upstream PR
> that is named for being incompatible with quantum recoverability, and whether that matters
> long-term is a question I've raised and can't answer.
>
> Code: https://github.com/Fatihmaull/zcash-multisig
>
> I'd value being told where this is wrong.

---

## 6 — Follow-up, once, after four days

One follow-up. Not two.

> Hi [name] — following up once in case this got buried. No reply needed if it isn't of
> interest; I won't chase it again.
>
> The one thing I'd still value is a yes or no on whether [the problem] is real for you. Even a
> one-line no is useful — I'd rather drop a wrong assumption than carry it into a submission.
>
> [your name]

---

## 7 — Permission to quote · **do not skip this**

An LOI we cannot attribute is not evidence. The moment someone says something useful, ask:

> That's genuinely helpful, thank you.
>
> May I quote that in the hackathon submission, attributed to you and [organisation]? I'll send
> you the exact sentence and the surrounding context first, and I'll drop it if you'd rather not
> — or use it unattributed as "a ZCG grantee" if that's easier.
>
> [your name]

Then actually send them the sentence. Quoting someone in a way they have not seen is how a
supporter becomes a correction in public.

---

## What goes in the submission

[09-traction.md](09-traction.md) has the rule and it is the one to hold: **write the truth,
precisely.** Named organisations and their verbatim reactions. LOIs quoted with attribution and
permission. The forum thread, with dates. No user count, and interest is not adoption.

If by 8 October there is nothing, §10 of the submission says there is nothing and why. That is a
worse section and a better submission than the alternative, and a judge in a field of 50–100 who
catches one inflated traction claim discounts everything else.
