#!/usr/bin/env bash
# From an authorized transaction to a confirmed txid, in one command.
#
#   ./scripts/prove-and-broadcast.sh ./secrets/pczt-ceremony/signed.hex ./secrets/ceremony-watch
#
# The four steps this replaces were run by hand for both of our on-chain
# spends, and four hand-run steps in the middle of a recording is four chances
# to fumble one.
#
# WHY THIS IS NOT IN THE WEB TIER
#
# Proving needs the Orchard proving key and is a heavyweight Rust operation.
# It cannot happen in Node, and putting it behind a web route would mean
# either shelling out to this anyway or adding a prover to the browser tier
# that has no business being there. The honest split: the coordinator
# authorizes, and authorized transactions are proved and broadcast here.
#
# Proving needs no authority. It cannot change what the transaction does — the
# signatures are already fixed — so it is safe to run anywhere, including on a
# machine that holds no share.

set -euo pipefail

SIGNED="${1:?usage: prove-and-broadcast.sh <signed.hex|signed.pczt> <watch-wallet-dir>}"
WALLET="${2:?missing watch-only wallet directory}"
DT="${DT:-$(command -v zcash-devtool || true)}"
WORK="$(dirname "$SIGNED")"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

if [ -z "$DT" ]; then
  cat <<'MISSING'

  zcash-devtool is not installed. It builds the transaction, proves it and
  talks to lightwalletd — all the parts that are not ours.

    git clone https://github.com/zcash/zcash-devtool && cd zcash-devtool
    cargo build --release

  Then set DT to the built binary.

MISSING
  exit 1
fi

# Accept either hex or raw. The coordinator hands back hex; a file written by
# an earlier run may be either.
PCZT="$WORK/proving-input.pczt"
if head -c 16 "$SIGNED" | LC_ALL=C grep -qE '^[0-9a-fA-F]+$'; then
  python3 -c "
import pathlib, sys
pathlib.Path(sys.argv[2]).write_bytes(bytes.fromhex(pathlib.Path(sys.argv[1]).read_text().strip()))
" "$SIGNED" "$PCZT"
else
  cp "$SIGNED" "$PCZT"
fi

say "Proving"
echo "  no authority needed — the signatures are already fixed"
"$DT" pczt prove "$PCZT" --output "$WORK/proved.pczt"
echo "  proved → $WORK/proved.pczt"

say "Broadcasting"
TXID=$("$DT" pczt -w "$WALLET" send "$WORK/proved.pczt" 2>&1 | tail -1 | tr -d '[:space:]')
case "$TXID" in
  [0-9a-f]*) : ;;
  *) echo "  the node did not return a txid:"; echo "  $TXID"; exit 1 ;;
esac
echo "  $TXID"

say "Waiting for a block"
for _ in $(seq 1 40); do
  "$DT" wallet -w "$WALLET" sync >/dev/null 2>&1 || true
  LINE=$("$DT" wallet -w "$WALLET" list-tx 2>/dev/null | grep -A 1 "^$TXID" | tail -1 || true)
  case "$LINE" in
    *Mined*) echo "  ${LINE##* Mined: }" | sed 's/^/  mined at height /'; break ;;
    *) printf '  unmined…\n'; sleep 20 ;;
  esac
done

say "Confirmed"
cat <<NOTE
  txid   $TXID

  Verify it the way an auditor would — with the vault's viewing key, not a
  block explorer. An explorer can confirm a shielded transaction exists and
  nothing else, which is the point of a shielded transaction:

    $DT wallet -w $WALLET list-tx
NOTE
