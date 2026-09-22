# 14 — Traction Kickoff Package

**Owner: Dev B. Task P0-B5. Started 22 Sep 2026.**

---

## Contact List — 10 Targets

| # | Who | Organisation / Role | Channel | Priority | Status |
|---|---|---|---|---|---|
| 1 | **Zcash Foundation** (general / FROST team) | ZF — owns FROST, DKG, frostd | Email / GitHub | **P0** (blocks technical question) | ⬜ Draft ready |
| 2 | **ZCG (Zcash Community Grants)** | Grant committee | Forum / email | High | ⬜ Draft ready |
| 3 | **ZecHub** | Community education / docs | Twitter DM / Forum | High | ⬜ Draft ready |
| 4 | **Zingo Labs** (Zingo wallet) | Wallet team — shielded UX expertise | GitHub / email | High | ⬜ Not started |
| 5 | **Nighthawk Apps** | Wallet team — mobile shielded | Twitter / email | Medium | ⬜ Not started |
| 6 | **Hanh** (YWallet author) | Independent wallet dev, knows Ironwood | Forum / GitHub | Medium | ⬜ Not started |
| 7 | **Jason McGee** (Shielded Labs) | Zcash dev, ZSA contributor | Twitter / email | Medium | ⬜ Not started |
| 8 | **Adi / ZcashBrazil** | Regional community leader | Twitter DM | Low | ⬜ Not started |
| 9 | **Free2Z creators** | Content creators using Zcash | Forum | Low | ⬜ Not started |
| 10 | **Zcash Community Forum** | Public build thread | forum.zcashcommunity.com | **P0** (visible to judges) | ⬜ Draft ready |

---

## Email Templates

### Template 1 — Technical Question to Zcash Foundation (Priority Contact)

> **Subject:** FROST vault FVK derivation under Ironwood — intended path?
>
> Hi,
>
> I'm building a shared-custody layer over re-randomized FROST for the Crypto
> World's Fair Zcash track, targeting the Ironwood pool.
>
> Working through `zcash-sign`, I see the vault's Orchard full viewing key is
> derived with
> `FullViewingKey::from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed()`,
> which lives in the fork behind zcash/orchard#475 rather than the published
> crate.
>
> Two questions:
>
> 1. Now that constructor is marked for removal, what is the intended FVK
>    derivation for a FROST-controlled vault?
> 2. Does using it forfeit Ironwood's quantum recoverability for funds in that
>    vault, or does it only affect key recovery while spend authorization is
>    unaffected?
>
> I'd rather ask than guess — it's a custody tool, and I don't want to
> overstate what it guarantees.
>
> Best,
> [Your Name]

### Template 2 — Outreach to ZCG Grantees

> **Subject:** Shared custody for shielded ZEC — does this match a problem you have?
>
> Hi [Name],
>
> I'm building a shared-custody layer for Zcash shielded funds for the Crypto
> World's Fair Zcash track — 2-of-3 threshold control using the Foundation's
> FROST work, with an audit export derived from the vault's viewing key so a
> grant funder can verify spending independently.
>
> The premise is that organisations holding shielded ZEC currently choose
> between a transparent address and one person holding the seed, and that the
> second one isn't a control you can put in front of an auditor.
>
> Does that match a problem you actually have? I'd value ten minutes, or just
> a blunt reply telling me it isn't real.
>
> Best,
> [Your Name]

### Template 3 — Wallet Team Review Request

> **Subject:** Where does threshold signing break for shielded wallet users?
>
> Hi [Name],
>
> We're building Quorum — a 2-of-3 threshold signing layer for Zcash shielded
> funds (Ironwood pool), using re-randomized FROST. The signer runs as a
> separate process on each participant's device; the browser shows status but
> never holds key material.
>
> You know more about where shielded UX breaks than anyone. Two questions:
>
> 1. From your experience building [Zingo/Nighthawk/YWallet], what's the
>    biggest UX failure mode you'd expect in a multi-device signing flow?
> 2. Is there anything in the Ironwood transition that makes threshold signing
>    harder than it would have been under Orchard?
>
> Happy to share a testnet demo once we have a confirmed spend (targeting
> 27 Sep).
>
> Best,
> [Your Name]

---

## Zcash Community Forum — Launch Thread

**Title:** `Building Quorum: shared custody for shielded Zcash (Ironwood + FROST)`

**Category:** `Development` or `Projects`

> ### What we're building
>
> **Quorum** is a shared-custody layer for Zcash shielded funds. Think of it as
> multi-sig for shielded ZEC: a 2-of-3 (or t-of-n) threshold where no single
> person ever holds the spending key, and an auditor can independently verify
> every transaction using the vault's viewing key — without trusting us.
>
> Built on re-randomized FROST (`frost-core` v3.0.0, RedPallas ciphersuite),
> targeting the **Ironwood pool** on testnet. This is for the Colosseum Crypto
> World's Fair Zcash track.
>
> ### The technical insight worth sharing early
>
> In the v6 transaction format, Sapling/Orchard/Ironwood anchors are
> **authorizing data** — they can be chosen *after* signatures are collected,
> at broadcast time. This eliminates the biggest UX problem in threshold
> signing: the anchor going stale while signers take hours to respond.
>
> Under v5, a stale anchor meant re-signing from scratch. Under v6, you just
> re-anchor and re-broadcast. The collected signatures stay valid.
>
> This isn't our invention — it's upstream design (`librustzcash` #2525). But
> it changes the viability of threshold signing for organisations that can't
> get three people in a room simultaneously.
>
> ### What we're NOT claiming
>
> - This is **not audited**. `frost-rerandomized` is not covered by the NCC
>   Group audit of `frost-core`.
> - This is **testnet only**. No mainnet funds at any point.
> - We do not know whether FVK derivation via the forked orchard constructor
>   forfeits Ironwood's quantum recoverability. We've asked ZF directly.
>
> ### Where we are
>
> - ✅ Phase 0 complete: FROST v3 + RedPallas verified, DKG over frostd with
>   authenticated channels, PCZT v2 + Ironwood feasibility confirmed.
> - 🔨 Phase 1 (this week): threshold-signed Ironwood spend confirming on
>   testnet. CLI only, no UI.
> - Gate B target: **27 Sep** — a 2-of-3 shielded spend from a FROST vault,
>   confirmed on testnet.
>
> ### Build log
>
> We'll post progress here 2-3 times this week. Feedback welcome — especially
> "this won't work because..." from people who've been deeper into the stack.
>
> **Repo:** https://github.com/Fatihmaull/zcash-multisig
>
> ---
> *Team: @fatihmaull (protocol/crypto) + @rafzhka (product/infrastructure)*

---

## Checkpoints (from [09-traction.md](09-traction.md))

| Date | Target | Status |
|---|---|---|
| 22 Sep | 10 contacts identified, build log live, forum thread posted | ⬜ Ready to execute |
| 29 Sep | 3+ substantive replies, first LOI conversation opened | ⬜ Pending |
| 6 Oct | 3–5 LOIs or quotable reactions secured, with permission | ⬜ Pending |
| 10 Oct | Traction section written into the submission | ⬜ Pending |

---

## Rules (from [09-traction.md](09-traction.md))

- **Ask for a reaction, not a favour.** "Would you use this?" not "Can you endorse us?"
- **Every public post is an external claim** — no "audited", no "secure", no "production-ready".
- **Understatement buys credibility** with this audience. Overstatement spends it permanently.
