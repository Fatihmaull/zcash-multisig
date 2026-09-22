# 15 — Testnet Source Wallet & Ironwood Funding Guide

**Owner: Dev B. Task P0-B3.**

---

## Source Wallet Address

The project's testnet Unified Address (active recipient for proposals and fixtures):

```
utest1e8r405y4n63fyc7c2zak6jvuhjtqfjuyh7m58tdfagusj3ggeyw40dqcatd90asu6wqj5gdm9e0fz2hyzj36h62tvervzu4uvaf97ungzlcurke65y32wzr2u05n6ak5m2c2y5c9rthztrpr3yk6p24nzguts34zet3seml70856fxcrrehptfq8mqfyx0km2et8m4a72vjukmr9gg6
```

This is a Unified Address containing receivers for multiple pools. Faucets will
typically pay into the **Sapling** or **Transparent** receiver embedded in it.

---

## How to Fund

### Step 1 — Request TAZ from a faucet

| Faucet | URL | Notes |
|---|---|---|
| JinoLabs | https://zcashfaucet.jinolabs.xyz | 0.1 TAZ, browser proof-of-work |
| Fauzec | https://fauzec.com | Pays to UA or Sapling; no transparent |
| Zeropond | http://zeropond.com | Alternative faucet |

Paste the Unified Address above. The faucet will send TAZ to whichever receiver
it supports — most commonly Sapling.

### Step 2 — Verify which pool the note landed in

Before assuming Gate B is fundable, **check the pool**. Use a wallet that shows
pool information (YWallet in testnet mode, or `zcash-cli` on a local node):

- If the note is in **Sapling**: proceed to step 3.
- If the note is in **Ironwood**: you are done — P0-B3 is complete.
- If the note is in **Transparent**: shield it first (send to yourself, shielded).

### Step 3 — Self-transfer into Ironwood

Faucets do not pay directly into Ironwood. A self-transfer moves the note from
Sapling into the Ironwood pool:

1. Open your wallet (YWallet recommended, set to **Testnet**).
2. Send the full balance to **your own** Unified Address.
3. The wallet's coin selection should automatically route into Ironwood if the
   wallet version supports it (post-NU6.3 wallets do).
4. Wait for 1 confirmation.
5. Verify the received note is in the **Ironwood pool**.

If the wallet does not support Ironwood output, the note will land in Sapling
again. In that case, you need a wallet version that has been updated for NU6.3
(Ironwood). Check for updates to YWallet, Zashi, or use `zallet` CLI.

### Step 4 — Record the funding transaction

Once confirmed, record:
- The funding txid
- The pool the note landed in (must be Ironwood)
- The amount (should be ≥ 0.1 TAZ for Gate B testing)

Store this in `secrets/funding-record.txt` (gitignored).

---

## Why Ironwood specifically

Constraint C1 from [04-technical-constraints.md](04-technical-constraints.md):
Orchard has been exit-only since 28 July 2026. A demo spending from the wrong
pool at a Zcash-track hackathon is an instant credibility loss.

Gate B requires a confirmed **Ironwood** spend. The vault will be funded by
transferring from this source wallet into the vault address produced by DKG
(P1-A1). The vault address is also an Ironwood address.

---

## Lightwalletd Endpoint

The project uses:

```
LIGHTWALLETD_ENDPOINT=https://testnet.zec.rocks:443
```

Verified 19 Sep 2026 to serve Ironwood data (block height 4,367,867, 233,867
blocks past Ironwood activation at 4,134,000). See
[03-architecture.md](03-architecture.md) §6 for the full verification record.

Alternative endpoint (configured but currently offline on port 19067):
```
https://zcash.mysideoftheweb.com:9067  (port 9067 responds, likely mainnet)
```
