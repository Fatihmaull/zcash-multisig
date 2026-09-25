#!/usr/bin/env bash
# A key ceremony in three processes, over a real frostd.
#
#   ./scripts/three-party-ceremony.sh ./secrets/ceremony
#
# This is the run that closes the last Gate B criterion. `examples/ceremony.rs`
# builds the same vault in one process and says so in its own output; here
# the three shares are never in the same address space, not even at birth.
#
# The distinction the submission has to keep straight:
#
#   no party sees more than one share WHILE SIGNING   → three-signer-demo.sh
#   no party EVER saw more than one share             → this
#
# frostd is the Zcash Foundation's relay. It is not ours, it is not trusted,
# and it never sees a round-2 package: those are sealed peer-to-peer with
# Noise_K before they reach it.
#
#   cargo install --git https://github.com/ZcashFoundation/frost-zcash-demo frostd
#
# Pass MISBEHAVE_SEED=1 to have the seed contributor send Bob a different
# vault seed than Carol. The ceremony completes cryptographically and the
# confirmation round catches it — which is the point of having one.

set -euo pipefail

OUT="${1:-./secrets/ceremony}"
PASSPHRASE="${QUORUM_DEV_PASSPHRASE:-quorum-dev-fixture}"
FROSTD_PORT="${QUORUM_FROSTD_PORT:-2744}"
FROSTD_URL="http://127.0.0.1:${FROSTD_PORT}"
RUN="${QUORUM_DEMO_LOGS:-$(mktemp -d)}"
mkdir -p "$RUN"
LABELS=(Alice Bob Carol)
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

FROSTD_BIN="${FROSTD_BIN:-$(command -v frostd || true)}"
if [ -z "$FROSTD_BIN" ]; then
  cat <<'MISSING'

  frostd is not installed, and this demo needs a real one — running the
  ceremony against a mock we wrote ourselves would prove only that our
  code agrees with our code.

    cargo install --git https://github.com/ZcashFoundation/frost-zcash-demo frostd

  Or set FROSTD_BIN to a built binary. The in-repo test
  `cargo test -p quorum-signer --test distributed_ceremony` covers the same
  choreography against a mock relay and needs nothing installed.

MISSING
  exit 1
fi

say "Building"
cargo build --release --manifest-path packages/core/Cargo.toml --bin quorum-dkgd 2>&1 | tail -1
BIN=packages/core/target/release/quorum-dkgd

say "Starting frostd"
# --no-tls-very-insecure is acceptable here and ONLY here: every participant
# is on this machine, and the payloads are already sealed with Noise before
# they reach the relay. On a real network this flag is a downgrade attack
# you performed on yourself.
"$FROSTD_BIN" --no-tls-very-insecure -i 127.0.0.1 -p "$FROSTD_PORT" \
  >"$RUN/frostd.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 40); do
  curl -sf -X POST "$FROSTD_URL/challenge" >/dev/null 2>&1 && break
  sleep 0.25
done
echo "  frostd pid ${PIDS[0]} on 127.0.0.1:$FROSTD_PORT — relays sealed bytes, reads none of them"

say "Generating one identity per participant"
rm -rf "$OUT"
mkdir -p "$OUT"
for label in "${LABELS[@]}"; do
  key="$OUT/$(echo "$label" | tr 'A-Z' 'a-z').key"
  pub=$("$BIN" keygen "$key" | awk '/^    [0-9a-f]{64}$/{print $1}')
  echo "  $label  ${pub:0:16}…"
  eval "PUB_$label=$pub"
done

say "Writing the roster"
# In production this file is the contact-verification artifact: each
# participant checks every fingerprint out of band before the ceremony, and
# Noise_K trusts it absolutely thereafter. Generating it here is a fixture
# convenience and hides the one step a real deployment must not skip.
python3 - "$OUT" "$PUB_Alice" "$PUB_Bob" "$PUB_Carol" <<'PY'
import json, sys, pathlib
out = pathlib.Path(sys.argv[1])
labels = ["Alice", "Bob", "Carol"]
roster = {
    "threshold": 2,
    "participants": [
        # FROST identifiers are little-endian scalars; 1, 2, 3 here matches
        # what examples/ceremony.rs produces, so share-N.bin lines up with
        # the signing demo.
        {"label": label,
         "identifier": (i + 1).to_bytes(32, "little").hex(),
         "pubkey": sys.argv[2 + i]}
        for i, label in enumerate(labels)
    ],
}
(out / "roster.json").write_text(json.dumps(roster, indent=2) + "\n")
PY
echo "  $OUT/roster.json — 2-of-3"

say "Running the ceremony — three processes, one share each"
i=0
for label in "${LABELS[@]}"; do
  i=$((i+1))
  lower=$(echo "$label" | tr 'A-Z' 'a-z')
  # Alice opens the frostd session and contributes the vault seed. Neither
  # is authority: the session coordinator only routes, and the seed is a
  # value everyone ends up holding. What stops her equivocating on the seed
  # is the confirmation round, not her restraint.
  CREATE=""; SEED="await"
  if [ "$label" = "Alice" ]; then CREATE=1; SEED="contribute"; fi
  MIS=""
  [ "${MISBEHAVE_SEED:-}" = "1" ] && [ "$label" = "Alice" ] && MIS=1

  env \
    QUORUM_FROSTD_URL="$FROSTD_URL" \
    QUORUM_DKG_ROSTER="$OUT/roster.json" \
    QUORUM_DKG_IDENTITY="$OUT/$lower.key" \
    QUORUM_DKG_OUT="$OUT" \
    QUORUM_DKG_PASSPHRASE="$PASSPHRASE" \
    QUORUM_DKG_TIMEOUT_SECS=60 \
    ${CREATE:+QUORUM_DKG_CREATE_SESSION=1} \
    QUORUM_DKG_SEED="$SEED" \
    ${MIS:+QUORUM_DKG_MISBEHAVE_SEED=1} \
    "$BIN" >"$RUN/$label.log" 2>&1 &
  PIDS+=($!)
  printf '  %-6s pid %-7s → %s/%s/share-%d.bin%s\n' \
    "$label" "$!" "$OUT" "$lower" "$i" \
    "$([ -n "$MIS" ] && echo '   ← will send a different seed to each peer')"
  # Alice must open the session before the others look for it.
  [ "$label" = "Alice" ] && sleep 1
done

say "Waiting"
FAILED=0
for pid in "${PIDS[@]:1}"; do
  wait "$pid" || FAILED=1
done

for label in "${LABELS[@]}"; do
  printf '\n  ── %s ─────────────────────────────────────────\n' "$label"
  # -E because BSD sed has no \| alternation in basic regex, and the macOS
  # default is BSD. Without it this silently prints nothing.
  sed -nE '/ceremony complete|CEREMONY FAILED/,$p' "$RUN/$label.log" | head -24
done

echo
echo "  logs: $RUN"

if [ "$FAILED" != 0 ]; then
  say "The ceremony aborted"
  cat <<'NOTE'
  If this was MISBEHAVE_SEED=1, that is the pass condition: the confirmation
  round caught two participants deriving different addresses and nobody
  wrote a share. A vault that disagrees with itself is worse than no vault —
  it takes funds with it.
NOTE
  exit 1
fi

say "What just happened"
cat <<NOTE
  Three OS processes ran a FROST DKG through a relay none of them trusts.

    round 1   commitments, sealed per recipient
    round 2   one secret package per recipient — the relay sees ciphertext
    round 3   each process derives its own share, alone
    confirm   all three agree on the group key and the address, or abort

  No process ever held a second share. Not during signing, and not now
  during key generation, which is the claim we could not make yesterday.

  Shares:
$(for j in 1 2 3; do l=$(echo "${LABELS[$((j-1))]}" | tr 'A-Z' 'a-z'); printf '    %s\n' "$OUT/$l/share-$j.bin"; done)

  The vault seed is in $OUT/vault-seed.hex and is a SHARED SECRET: enough to
  read every transaction this vault ever makes, not enough to spend one.
NOTE
