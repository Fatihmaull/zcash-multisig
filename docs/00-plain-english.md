# Quorum — Plain English Guide

> ### ⚠️ Read this first
>
> Quorum is a **hackathon build, on Zcash testnet only**. It has never held real money and
> must not. The threshold cryptography underneath it (`frost-core`) is audited by NCC Group,
> but **the rerandomized variant Zcash requires is not covered by that audit**, and the
> specification it follows (ZIP-312) is still a Draft. Several parts of the interface described
> below currently run against a **simulator, not the Zcash network**; those are marked.
>
> This is a demonstration that the approach works. It is not a custody product yet.
> [What is still missing →](10-roadmap.md#phase-5--the-path-to-actually-usable)

---

> **A real-world analogy**
>
> Imagine an office safe that needs **three separate keys**, held by Alice, Bob and Carol.
> To open it, **at least two of the three** must turn their key. Neither the safe's manufacturer
> nor the building's landlord holds a key — they could not open it if they wanted to.
>
> Two things make the Zcash version unusual:
>
> 1. **Shielded privacy.** The amounts and the parties are hidden from public view, rather than
>    posted on a public ledger the way Bitcoin or Ethereum transactions are.
> 2. **Zero custody.** Quorum's servers never hold or see a key. Each share stays on its
>    holder's own machine.

---

## 1. What problem does Quorum solve?

**On most public blockchains, everything is visible.** Every balance and every payment on
Bitcoin or Ethereum can be read by anyone with a web browser. For an organisation, that means
publishing your treasury.

**Zcash shielded pools fix that.** Using zero-knowledge cryptography, shielded transactions
hide the amount, the sender and the recipient from public view.

**But shielded pools have no multisig.** There is no way, at the protocol level, to say "two of
these three people must agree before this moves." So an organisation holding shielded ZEC has
had to choose:

- Use a **transparent address**, and publish every balance and transfer — discarding the entire
  reason to use Zcash; or
- Let **one person hold the key**, which is not a control an auditor will accept, and is one
  lost laptop away from losing everything.

**What Quorum adds.** The threshold cryptography that solves this — FROST with the RedPallas
ciphersuite — already exists, and the Zcash Foundation built it. What did not exist is anything
an organisation can actually operate: a key ceremony a non-cryptographer can complete, an
approval workflow, a clear answer when a signature fails, and a record an auditor can verify.

**That layer is Quorum.** We did not build the cryptography. We built the part that makes it
usable on a Monday morning.

## 2. The jargon, in plain terms

| Term | What it means |
|---|---|
| **Zero-custody / non-custodial** | We never hold your funds or your keys. Each key share stays on its holder's own machine, in a separate signing application — deliberately **not** in a web browser, which is a far easier thing to compromise. |
| **Threshold / 2-of-3** | Out of three key holders, at least two must approve before money can move. One alone can do nothing. |
| **Shielded address** | A Zcash address whose balance and transaction amounts are not published on the public ledger. |
| **Key ceremony (DKG)** | The setup step where the three participants jointly create the vault. Each ends up with their own share, and the complete key is never assembled anywhere — not on their machines, and not on ours. |
| **Culprit identification** | If a participant submits a signature share that does not check out, the protocol can tell *which* share was bad. The signing round is abandoned and nothing is spent. It identifies the share, not the reason — a compromised device and a corrupted transfer look the same from here. |
| **Coordinator** | Someone has to collect the pieces. Quorum runs that role, and it can stall a signing round by refusing to pass messages along. What it cannot do is move money: below the threshold, the signature simply does not exist. |

## 3. What the application does

**Key ceremony.** A guided flow that walks three participants through creating a vault together
— naming it, setting the 2-of-3 rule, connecting the participants, and producing the shared
shielded address.

**Spend approvals.** A proposer creates a request. Co-signers see what they are approving in
plain language before anything cryptographic happens, then approve or decline. Two approvals
release the transaction.

**Signer status.** Who has approved, who has not, and who is simply not responding. A signer on
a plane is a normal situation, not an error.

**Misbehaviour detection.** If a share does not verify, the interface names the participant,
states that nothing was spent, and says what to do next — rather than printing an error message
only a programmer could read.

### 🧪 Currently simulated

| Feature | Status |
|---|---|
| Scenario sandbox — happy path, signer timeout, corrupt share | **Simulator.** These run against a mock coordinator so the interface could be built before the cryptography was wired in. They demonstrate the intended behaviour, not a live network. |
| Shielded balances shown in the interface | **Placeholder figures.** Reading real balances needs note scanning against a Zcash node, which is not connected yet. |
| Signing, broadcast, confirmation | **Not yet connected to the network.** The Rust signing core is scaffolded and awaiting implementation. |

Everything in this section is scheduled work, tracked in [10-roadmap.md](10-roadmap.md).

## 4. What Quorum is not

Being precise about this matters more than sounding impressive — especially for a product that
proposes to stand between an organisation and its money.

- **Not audited.** `frost-core` is audited; `frost-rerandomized`, which Zcash requires, is not.
  Our own integration has never been reviewed by anyone.
- **Not for real funds.** Testnet only, with no exceptions, for the duration of this build.
- **Not finished cryptography.** ZIP-312 is a Draft and may still change. Ironwood support in
  the underlying Zcash libraries is on release candidates with open issues.
- **Not perfectly private.** Shielded transactions hide amounts and participants from the public
  ledger. They do not hide that a transaction happened, its timing, or anything your own
  infrastructure logs. Anyone claiming a system is "100% private" is selling something.
- **Not a wallet.** No portfolio, no prices, no general-purpose sending. Shared control and
  provable disclosure, nothing else.
- **Not recoverable yet.** If a participant loses their share today, there is no recovery flow.
  The underlying library supports one; we have not built the interface for it. For a custody
  tool this is a serious gap, and it is the first thing on the post-hackathon roadmap.

## 5. Running it locally

```bash
cd apps/web
pnpm install
pnpm dev
```

Then open **http://localhost:3000**.

The interface runs against the mock coordinator, so no Zcash node is required to look around.

---

**More detail:** [README](../README.md) · [architecture](03-architecture.md) ·
[technical constraints](04-technical-constraints.md) · [roadmap](10-roadmap.md)
