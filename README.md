# Quorum

**Shared custody for Zcash shielded funds.**

Zcash shielded pools have no multisig opcode. An organisation holding ZEC today must either use a
transparent address — losing the entire reason to use Zcash — or let one person hold the seed.
Quorum is the organisational layer over re-randomized FROST that makes threshold control of
shielded funds usable by a treasurer on a Monday morning.

> **We are not building cryptography.** `frost-core` v3.0.0 is audited and stable. The
> transport (`frostd`) exists. The gap is everything between the library and an organisation
> that has to pass a controls audit. That is what we build, and that is why 26 days is realistic.

---

## Status

| | |
|---|---|
| **Phase** | Pre-development — documentation complete, no application code yet |
| **Next action** | Spike S1 (see [docs/05-plan.md](docs/05-plan.md)) — get `frost-zcash-demo` running with RedPallas |
| **Hackathon** | Colosseum Crypto World's Fair, Zcash track |
| **Window** | 14 Sep – 12 Oct 2026 |
| **Days remaining** | 26 (as of 16 Sep 2026) |
| **Target** | Top 10 of the Zcash track ($10,000). General pool is a lottery ticket, not a plan. |
| **Network** | **Testnet only. No mainnet funds, ever, during this build.** |

---

## Read in this order

| Doc | What it settles |
|---|---|
| [01-strategy.md](docs/01-strategy.md) | Why the Zcash track, how we're positioned, how we score against each judging criterion |
| [02-product-spec.md](docs/02-product-spec.md) | The problem, the flows we build, and the hard scope boundary |
| [03-architecture.md](docs/03-architecture.md) | Components, trust boundaries, what never touches our server |
| [04-technical-constraints.md](docs/04-technical-constraints.md) | Non-negotiable technical facts, verified Sept 2026, with failure modes |
| [05-plan.md](docs/05-plan.md) | 26-day calendar, five hard gates, who does what |
| [06-risk-register.md](docs/06-risk-register.md) | What kills this project and what we do instead |
| [07-demo-script.md](docs/07-demo-script.md) | The three-minute video, beat by beat |
| [08-prior-art.md](docs/08-prior-art.md) | Exact crates and repos — what to build on, what never to rebuild |
| [09-traction.md](docs/09-traction.md) | The one judging criterion we cannot earn by coding |

[CLAUDE.md](CLAUDE.md) is the persistent context for Claude Code sessions. It is loaded
automatically; you do not need to paste a brief.

---

## The three things that kill this project

1. **Targeting the wrong pool.** Orchard went exit-only on 28 July 2026. A demo that spends
   from Orchard is demoing a deprecated pool in front of the community that deprecated it.
   **We target Ironwood.** See [04-technical-constraints.md](docs/04-technical-constraints.md).

2. **The happy path never lands.** PCZT v2 + Ironwood support sits on release candidates with
   open upstream issues. If a 2-of-3 shielded spend does not confirm on testnet by **27 Sept**,
   we switch to the degraded demo defined in [06-risk-register.md](docs/06-risk-register.md).
   Everything else is decoration.

3. **The demo is rushed.** Hackathon projects lose because the video was recorded at 2am on
   deadline day, not because the code was bad. **Feature freeze 4 Oct. Recording starts 5 Oct.
   Submit 10 Oct**, two days early.

---

## Security posture — read before writing any claim

`frost-core` is audited by NCC Group. **`frost-rerandomized` is not covered by that audit** and
its documentation still carries an API-may-change warning. ZIP-312 is still a Draft.

Never describe this project as audited, production-ready, or safe for mainnet funds. Overstating
the security posture of a custody product is the worst failure mode available to us — worse than
missing the deadline. When unsure whether something is audited, write that we are unsure.
