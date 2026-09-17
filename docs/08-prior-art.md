# 08 — Prior art

**Nothing on this page gets rebuilt.** The four-week timeline is only realistic because all of
it already exists. Read before writing any code that feels foundational — if it feels
foundational, someone has probably already shipped it.

---

## Build on — do not reimplement

| What | Where | Status | Our use |
|---|---|---|---|
| `frost-core` | `ZcashFoundation/frost` | **v3.0.0, stable, audited by NCC Group.** Implements RFC 9591 | Threshold signing core |
| `frost-rerandomized` | same repo | **NOT covered by the NCC audit.** API-may-change warning still present | Zcash-compatible RedDSA signatures valid as spend authorizations |
| `reddsa` | `ZcashFoundation/reddsa` | Stable | RedPallas ciphersuite. Selecting it auto-switches to rerandomized FROST |
| Repairable Threshold Scheme | `frost-core` | Implemented | Lost-share recovery with help from a threshold of participants. **Roadmap, not this build** |
| Refresh Share | `frost-core` | Implemented | Signer rotation / participant removal. **Roadmap, not this build** |
| `frostd` | `ZcashFoundation/frost-zcash-demo` | Implemented | **Our transport layer.** Verify its channel guarantees in S1 |
| `frost-client` | same | Implemented | CLI reference for server interaction |
| `zcash-sign` | same | Implemented | Standalone Zcash Signer. **The reference pattern for our signer/coordinator split** |
| `pczt` | `zcash/librustzcash` | **v2 + Ironwood on `0.8.0-rc.1`**, open issues #2467 #2525 | Partially created transactions across devices |
| `zcash_client_backend` | `zcash/librustzcash` | **`0.24.0-rc.1`** | Note scanning, spendable-note selection, viewing-key history |
| `zcash_keys`, `zcash_address` | `zcash/librustzcash` | Stable | Key and address handling |
| Zebra, Zaino, Zallet | Zcash ecosystem | Current — **Z3 stack**. `zcashd` retired | Node and indexer |
| `zcash-devtool` | Zcash ecosystem | Has FROST support | Reference code for library integration |
| Blockchain Commons `zcash-frost-tools` | Blockchain Commons | Available | Standalone signer — architectural pattern for air-gapped flows |

## Running the reference demo

The `frost-zcash-demo` repository (now "FROST Tools for Zcash") contains seven projects:
**trusted-dealer**, **dkg**, **coordinator**, **participant**, **frostd**, **frost-client**, and
**zcash-sign**.

```bash
git clone https://github.com/ZcashFoundation/frost-zcash-demo
cd frost-zcash-demo
cargo install
```

Pass `-C redpallas` to **every** command. This is constraint C4 and it is not optional:

```bash
cargo run --bin trusted-dealer -- -C redpallas
```

Three communication mechanisms are supported: CLI (copy/paste JSON between terminals), socket,
or HTTP via `frostd`. **Start with CLI** — it makes the protocol legible before transport
abstracts it away. Move to `frostd` once the rounds are understood.

Spike S1 target: `dkg`, `coordinator` and `participant` running with RedPallas in separate
terminals, producing a valid aggregated signature.

## Read before building

| Priority | Source |
|---|---|
| 1 | `ZcashFoundation/frost` — the **v3.0.0 changelog** especially. Most tutorial content online predates v3 and will mislead |
| 2 | `ZcashFoundation/frost-zcash-demo` — all seven projects, `zcash-sign` most closely |
| 3 | [ZIP-312](https://zips.z.cash/zip-0312) — FROST for Spend Authorization Multisignatures. **Still Draft** |
| 4 | [ZIP-2005](https://zips.z.cash/zip-2005) — Ironwood quantum recoverability. Confirms RedDSA spend auth survives |
| 5 | librustzcash [#2467](https://github.com/zcash/librustzcash/issues/2467) (Ironwood PCZT v2) and [#2525](https://github.com/zcash/librustzcash/issues/2525) (anchor deferrability) — these two own Gate B |
| 6 | Zebra [#10762](https://github.com/ZcashFoundation/zebra/pull/10762) — Ironwood and v6 transaction support |
| 7 | `zcash-devtool` FROST integration — working reference code |

## What we actually build

Everything above is the floor. Quorum is only these five things:

1. A guided **key ceremony** a non-cryptographer completes.
2. An **approval workflow** over FROST rounds — request, status, non-responding signer.
3. **Misbehaviour surfaced in human language** — `InvalidSignatureShare::culprits` translated
   into what happened, what it cost, what to do next.
4. A **viewing-key-backed audit trail** a third party can verify without trusting us.
5. The **organisational model** underneath it all — vaults, roles, participants, policy.

If a task does not serve one of these five, it is either prior art we should be reusing or
scope creep we should be cutting.

## Who else is in this space

**The Zcash Foundation.** Their 2026 roadmap: release FROST v3, finalise ZIP-312, implement DKG
for key generation and secure multiparty signing. They already ship `frostd` and
`frost-client`.

Read that honestly: we rejected Tempo partly because Stripe would build the obvious layer on
top of its own protocol, and the same test applied to Zcash lands at least as hard. The answer
is that ZF builds **protocol and reference tooling** — correct, general, CLI-shaped, for people
who already understand threshold signatures. Nothing in their roadmap is a product for a
treasurer who has never heard the word "ciphersuite".

Two binding consequences:

- **Never** position Quorum as "FROST tooling for Zcash." We lose that framing, deservedly.
- Frame ZF as **tailwind**, explicitly and in public. Their finalising ZIP-312 and shipping DKG
  de-risks our dependency stack. A judge from ZF should come away thinking we make their work
  more useful — not that we are racing them with less expertise.

See [01-strategy.md](01-strategy.md) §3 and [06-risk-register.md](06-risk-register.md) R7.
