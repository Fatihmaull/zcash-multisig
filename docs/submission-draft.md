# Quorum — Submission Draft (Zcash Track)

> **Task P3-B6 | Dev B — Product & Infrastructure**  
> **Target Date:** 10 October 2026 (Buffer through 12 October)  
> **Status:** Drafted per Risk Register R6 and Technical Constraints C1–C9  

---

## 1. Project Overview

- **Project Name:** Quorum
- **Tagline:** Honest, zero-custody threshold management for Zcash shielded treasuries.
- **Track:** Zcash Hackathon Track
- **Network:** Zcash Testnet (Nu6+ Ironwood Activation Pool)
- **Live Demo:** [https://quorum-zcash.vercel.app](https://quorum-zcash.vercel.app) *(or local preview)*
- **Repository:** `github.com/.../zcash-multisig`

---

## 2. The Problem: The Privacy Custody Trap

DAOs, privacy-preserving foundations, and grants programs holding Zcash face an impossible choice today:
1. **Hold transparent funds with multisig:** Sacrifice organizational privacy entirely by using transparent addresses where financial records, vendor payments, and operational runways are broadcast to the world.
2. **Hold shielded funds with a single key:** Put entire multi-million dollar treasuries in a single seed phrase or hardware wallet, introducing a single point of compromise or coercion.

Without threshold signatures native to the shielded pool, institutional custody in Zcash either leaks privacy or compromises operational security.

---

## 3. The Solution: Shielded Multisig on Ironwood

**Quorum** solves this by implementing an interactive **2-of-3 threshold signature scheme over Zcash's newest shielded pool (Ironwood)** using **FROST-RedPallas** (ZIP-312 / `frost-rerandomized`).

### Key Capabilities:
- **Zero Custody by Design:** Private key shares never touch the web app, coordinator, or database. Shares remain securely encrypted at rest on signers' devices.
- **Native Ironwood Shielded Pool:** Spends originate from and land within the shielded pool, preserving complete transaction confidentiality.
- **Deferred Anchor Binding (Constraint C3):** In compliance with ZIP-2005 / v6, the anchor is bound at broadcast time rather than ceremony time, guaranteeing that signing delays do not invalidate collected threshold signatures.
- **Deterministic Attribution & Misbehavior Handling (F4):** If a rogue or compromised signer submits an invalid share, Quorum identifies the exact participant culprit (`InvalidSignatureShare::culprits`) and aborts cleanly without risking vault funds.
- **Viewing-Key-Derived Audit Trails (F6):** Compliance exports (CSV/JSON) are verified cryptographically against the vault's Full Viewing Key (FVK) on-chain, rather than relying on mutable application database logs.

---

## 4. Architecture & Security Boundary

```
[ Alice Signer CLI ]    [ Bob Signer CLI ]    [ Carol Standby CLI ]
        │                       │                       │
        └─── TLS + Noise_K ─────┴─── TLS + Noise_K ─────┘
                                │
                        [ frostd Daemon ]
                                │
                   [ Quorum Coordinator Service ]
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
      [ Next.js Web App ]             [ Lightwalletd RPC ]
       (Zero Key Material)             (testnet.zec.rocks:443)
               │                                 │
      [ PostgreSQL / Prisma ]                    ▼
       (Audit & Metadata only)         [ Zcash Ironwood Testnet ]
```

### Architectural Guarantees:
- **No Private Keys on Server:** The database stores public identifiers, approval state, and encrypted viewing keys—zero spend authority.
- **Noise_K Encrypted Peer Transport:** Signer communication is end-to-end encrypted and authenticated.
- **Separation of Concerns:** Dev A protocol core (`quorum-core`) is completely decoupled from the Dev B user presentation layer.

---

## 5. Demonstration Walkthrough (The 5-Step Proof)

Our testnet demonstration executes the five canonical gates on testnet:
1. **F1 — Guided Key Ceremony:** 3 signers generate a 2-of-3 threshold vault with zero key exposure.
2. **F2 — Shielded Proposal Creation:** Proposer creates an outgoing grant transfer to a shielded recipient.
3. **F3 — Coordinated Threshold Signing:** Alice and Bob sign in two rounds; Carol remains on standby.
4. **F4 — Rogue Share Detection:** In a fault-injection scenario, a corrupted share is submitted. Quorum pinpoints the culprit with a domain error, excluding them while preserving fund safety.
5. **F5 & F6 — Broadcast & Audit Export:** The valid spend broadcasts to testnet, confirms in block height, and exports as a viewing-key-verified audit trail.

---

## 6. Honest Security Posture (What This Is NOT)

In accordance with our strict disclosure policy (**Risk R6**):

> **IMPORTANT:** Quorum is a prototype built for testnet to prove the cryptographic viability of threshold shielded spends. **It is NOT ready for mainnet or real financial custody.**

- **`frost-rerandomized` Audit Status:** While `frost-core` was audited by NCC Group, `frost-rerandomized` remains outside that audit scope and still carries upstream API-stability warnings.
- **ZIP-312 Status:** ZIP-312 is currently in Draft status with the Zcash Foundation.
- **Quantum Posture:** Zcash Nu6+ provides quantum *recoverability* via ZIP-2005, not quantum resistance. RedPallas signatures remain susceptible to future quantum algorithms.
- **Production Roadmap (Phase 5):** Deploying real foundation funds requires completing upstream share repair (Repairable Threshold Scheme), independent security reviews of our orchestration, and hardware/air-gapped signers (Blockchain Commons pattern).

---

## 7. Traction & Community Engagement

- **Target Audience:** Zcash Community Grants (ZCG), Zcash Foundation (ZF), Electric Coin Co (ECC), and privacy-preserving project treasuries.
- **Outreach Status:** Active correspondence with Zcash ecosystem participants as detailed in `docs/14-traction-kickoff.md`.
- **Feedback & Discussions:** Zcash Community Forum launch thread published with technical documentation.

---

## 8. Team & Roles

- **Dev A (Protocol & Cryptography):** FROST-RedPallas integration, PCZT bundle assembly, share encryption, coordinator state machine.
- **Dev B (Product & Infrastructure):** Web architecture, lightwalletd integration, Prisma/PostgreSQL, audit export engine, testnet plumbing, and video production.
