# 16 — Runbook: clean machine to a confirmed spend

**Written after the P4-1 rehearsal, 25 Sep.** Every command here was run against a
fresh `git clone` on that date. The txid at the bottom is real.

This exists because the flow that works was documented nowhere. It lived in pull
request descriptions and one closed issue. That is fine while one person is doing it
from memory and useless the moment somebody is recording.

> **Read this before the recording, not during it.** Two steps take minutes and
> cannot be hurried: the faucet, and a Zcash proof. Both are noted below.

---

## 0. What you need installed

| | Why | Time |
|---|---|---|
| Rust stable | the protocol core | cold build **52 s** |
| Node + pnpm | the web tier | `pnpm install` **6 s** |
| `frostd` | the relay the ceremony runs over | `cargo install --git https://github.com/ZcashFoundation/frost-zcash-demo frostd` |
| `zcash-devtool` | wallet, PCZT construction, broadcast | `git clone https://github.com/zcash/zcash-devtool && cargo build --release` |

Neither `frostd` nor `zcash-devtool` is vendored. Both are other people's tools and
the point is that we use them rather than reimplement them, but it does mean a clean
machine needs two extra builds. Do those first.

```bash
git clone https://github.com/Fatihmaull/zcash-multisig.git && cd zcash-multisig
cp .env.example .env
cargo build --release --manifest-path packages/core/Cargo.toml --bins
pnpm install
```

`secrets/` is gitignored and absent from a fresh clone. That is correct — it holds key
material — but it means **nothing under `secrets/` is a prerequisite you can rely on
finding.** Everything below creates what it needs.

---

## 1. The ceremony — three processes, one share each

```bash
./scripts/three-party-ceremony.sh ./secrets/ceremony
```

Starts `frostd`, generates three identities, writes a roster, and runs three
`quorum-dkgd` processes through the relay. Each writes exactly one sealed share into
its own directory. All three print the same address, or the run aborts.

```
Alice  pid 76968  → ./secrets/ceremony/alice/share-1.bin
Bob    pid 76974  → ./secrets/ceremony/bob/share-2.bin
Carol  pid 76979  → ./secrets/ceremony/carol/share-3.bin
```

**This is the beat the whole security claim rests on.** No process ever held a second
share, including during key generation. Say it once, plainly, and move on.

To show the failure mode instead — a seed contributor telling each peer a different
story, which FROST does not object to and which silently produces three vaults:

```bash
MISBEHAVE_SEED=1 ./scripts/three-party-ceremony.sh /tmp/doomed-vault
```

Same group key, three addresses, zero shares written.

---

## 2. Fund it — the step that needs a human, and time

```bash
cat ./secrets/ceremony/vault-address.txt
```

Paste into a faucet from [15-testnet-wallet-guide.md](15-testnet-wallet-guide.md).
0.1 TAZ is enough for several runs.

> **Do this at least an hour before recording.** Faucets are rate-limited, proof-of-work
> gated, and occasionally down. The 25 Sep payment landed directly in **Ironwood**, which
> is what we want, but that is the faucet's choice and not guaranteed — check before
> assuming.

Watch for it with a view-only wallet built from the vault's own key:

```bash
UFVK=$(cargo run -q -p quorum-signer --example vault_ufvk -- ./secrets/ceremony \
       | grep -oE 'uviewtest1[a-z0-9]+')
DT=/path/to/zcash-devtool

$DT wallet -w ./secrets/ceremony-watch init-fvk \
      --name ceremony-vault --fvk "$UFVK" --birthday <current height - 1000>
$DT wallet -w ./secrets/ceremony-watch sync
$DT wallet -w ./secrets/ceremony-watch balance
```

Wanted: `Ironwood Spendable` above zero. A note in Sapling or Transparent needs
shielding first — see the wallet guide.

This wallet is also the audit story: it is built from a **viewing key**, holds no
spend authority, and can reconcile every claim the event log makes.

---

## 3. Build the transaction

The vault has no spending key, so a wallet builds the transaction and we only
authorize it. The watch-only wallet is enough to build with.

```bash
ACCOUNT=$($DT wallet -w ./secrets/ceremony-watch list-accounts | grep -oE '^Account \S+' | cut -d' ' -f2)

$DT pczt -w ./secrets/ceremony-watch create \
      --address <recipient> --value 1000000 \
      --output ./secrets/pczt-ceremony/unsigned.pczt "$ACCOUNT"
```

**Then check it is the right vault's transaction, before anyone signs:**

```bash
cargo run -p quorum-coordinator --example which_vault -- ./secrets/pczt-ceremony/unsigned.pczt
```

```
secrets/vault          ✗ different vault
secrets/ceremony       ✓ MATCHES — 1 action(s) to sign
```

The coordinator refuses a mismatch anyway. Finding out here costs a second; finding
out mid-recording costs a take. On 25 Sep a demo ran to `APPROVED, 2 signatures`
against another vault's transaction — real quorum, valid signature, authorizing
nothing — which is why both the check and this line exist.

---

## 4. Sign it — three processes again

```bash
AUTHORIZED_OUT=./secrets/pczt-ceremony/signed.hex \
  ./scripts/three-signer-demo.sh ./secrets/ceremony ./secrets/pczt-ceremony/unsigned.pczt
```

Starts `quorum-coordinatord` and three `quorum-signerd`, one sealed share each. The
coordinator sees commitments and signature shares and never a share.

Threshold is two, so whichever pair answers first wins and the third stays `PENDING`.
That is correct behaviour and it looks like a bug on camera, so say it.

**The script auto-approves.** A real participant is asked first, having been shown what the
transaction spends and from which vault — that gate is the product, not decoration. A scripted
run cannot pause for a keystroke, so the script sets `QUORUM_SIGNER_AUTO_APPROVE=1` and each
signer logs a warning saying so.

To show the gate, run with `AUTO_APPROVE=0`:

```
  APPROVAL REQUEST  99b6bf69-…
  vault    Foundation Treasury
  sighash  613a0b41f944e109…

  FROM THE TRANSACTION — verified against your own share
    spend   Ironwood action 0  — spends from this vault
    output  Ironwood action 0  0.08990000 TAZ  to a named address
    output  Ironwood action 1  0.01000000 TAZ  to a named address

  CLAIMED BY THE PROPOSER — not verified, and not verifiable here
    to       utest1recipient
    amount   0.01000000 TAZ

  Approve and sign? [y/N]
```

Two columns, because they are two kinds of fact. Anything but an explicit yes declines, and
once enough participants decline the request closes as `REJECTED` with `QUORUM_UNREACHABLE`
rather than waiting out its deadline.

**For the misbehaving-signer beat, name the pair** — otherwise the culprit may never
get a turn:

```bash
SIGNERS="Bob Carol" MISBEHAVE=Bob \
  ./scripts/three-signer-demo.sh ./secrets/ceremony ./secrets/pczt-ceremony/unsigned.pczt
```

```
REJECTED 2  Alice=PENDING  Bob=INVALID_SHARE  Carol=APPROVED
⚠ Bob  SIGNATURE_SHARE  INVALID
  Signature share rejected — Bob. … no funds moved.
```

---

## 5. Prove, broadcast, confirm

Proving needs no authority — it is arithmetic over a transaction already authorized.
It is also **slow enough to notice**, so do not do it live.

```bash
python3 -c "import pathlib,sys; p=pathlib.Path('./secrets/pczt-ceremony'); \
  (p/'signed.pczt').write_bytes(bytes.fromhex((p/'signed.hex').read_text().strip()))"

$DT pczt prove ./secrets/pczt-ceremony/signed.pczt --output ./secrets/pczt-ceremony/proved.pczt
$DT pczt -w ./secrets/ceremony-watch send ./secrets/pczt-ceremony/proved.pczt
```

The txid prints. Then wait for a block:

```bash
$DT wallet -w ./secrets/ceremony-watch sync
$DT wallet -w ./secrets/ceremony-watch list-tx | grep -A 2 <txid>
```

`Unmined` becomes `Mined: <height>`. Testnet blocks are ~75 s but vary; the 25 Sep run
took under a minute.

---

## What this produced on 25 Sep

```
txid   259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61
block  4,390,493
       0.01 TAZ out, 0.0899 TAZ change back to the vault
```

A vault whose three shares were never in the same process spent shielded Ironwood
funds on testnet. **That is the whole product in one sentence**, and it is the sentence
to lead the submission with.

The earlier txid `0ef1e96411b770fb0aec7d35c820510cd303f696126ac85782158c75382681ce`
(block 4,383,363) remains on record as the first threshold-signed Ironwood spend and is
what carried Gate B four days early — but its vault was built by the single-process
fixture. Do not present the two as interchangeable.

---

## Gotchas the rehearsal actually found

| | |
|---|---|
| **`secrets/` is not in a fresh clone** | Correct, and it means no recipe or fixture under it can be a prerequisite. Everything needed is generated by the steps above. |
| **`frostd` keeps the session coordinator out of `session.pubkeys`** | A creator who omits themselves is unaddressable, their receive queue stays empty, and the round times out with no clue why. `quorum-dkgd` includes itself. |
| **A PCZT does not say which vault it is for** | It does, via `rk` — but only if you check. Step 3. |
| **Three signers, threshold two** | A race. Fine normally, fatal to a scripted misbehaviour beat. Use `SIGNERS=`. |
| **Proving is slow** | Do it off camera. |
| **The faucet is the long pole** | Not the code. Fund the vault before you sit down to record. |

## Still simulated

The web UI's signing flow is the mock unless `COORDINATOR_URL` is set — see
`.env.example`. With it set, `/api/approvals/[id]/sign` reads authoritative status from
`quorum-coordinatord` instead of counting rows. **The UI labels simulated flows on
screen; leave those labels in.** A judge who spots an unlabelled simulation stops
believing the parts that are real.
