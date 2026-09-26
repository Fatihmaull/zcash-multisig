#!/usr/bin/env bash
# Three signers, three processes, one vault.
#
#   ./scripts/three-signer-demo.sh ./secrets/vault-3p ./secrets/pczt/unsigned.pczt
#
# This is the run that makes the non-custodial claim demonstrable rather
# than asserted. Each signer is its own OS process holding exactly one
# sealed share; the coordinator holds none. Kill any single process and no
# secret is lost, because no process has more than a third of one.
#
# Pass MISBEHAVE=<label> to have that signer submit a share that does not
# verify — the F4 beat of the demo.
#
# Pass SIGNERS="Bob Carol" to start only those. With three signers online and
# a threshold of two, whichever pair answers first wins the race, so a
# misbehaving third never gets to misbehave. Naming the pair makes the run
# reproducible, which is what recording a demo requires.
#
# Signers auto-approve here. A real participant is asked, having been shown
# what the transaction spends and from which vault — the gate is the product,
# not decoration. A scripted run cannot pause for a keystroke, so this script
# sets QUORUM_SIGNER_AUTO_APPROVE=1 and each signer says so in its log. Pass
# AUTO_APPROVE=0 and run a signer by hand to see the prompt.

set -euo pipefail

VAULT="${1:-./secrets/vault-3p}"
PCZT="${2:-./secrets/pczt/unsigned.pczt}"
PASSPHRASE="${QUORUM_DEV_PASSPHRASE:-quorum-dev-fixture}"
ADDR="${QUORUM_COORDINATOR_ADDR:-127.0.0.1:2745}"
URL="http://${ADDR}"
RUN="${QUORUM_DEMO_LOGS:-$(mktemp -d)}"
mkdir -p "$RUN"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "Building"
cargo build --release --manifest-path packages/core/Cargo.toml \
  --bin quorum-coordinatord --bin quorum-signerd 2>&1 | tail -1
BIN=packages/core/target/release

say "Starting the coordinator"
QUORUM_COORDINATOR_ADDR="$ADDR" "$BIN/quorum-coordinatord" >"$RUN/coordinator.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 40); do
  curl -sf -X POST "$URL/health" >/dev/null 2>&1 && break
  sleep 0.25
done
echo "  coordinator pid ${PIDS[0]} on $ADDR — holds no key material"

say "Registering the vault"
REG=$(python3 - "$VAULT" <<'PY'
import json, sys, urllib.request, pathlib
d = pathlib.Path(sys.argv[1])
body = {
    "label": "Foundation Treasury",
    "threshold": 2,
    "address": (d / "vault-address.txt").read_text().strip(),
    "publicKeyPackage": json.loads((d / "public-key-package.json").read_text()),
    "participants": json.loads((d / "participants.json").read_text()),
}
req = urllib.request.Request("http://127.0.0.1:2745/coordinator/vault/register",
                             data=json.dumps(body).encode(),
                             headers={"content-type": "application/json"})
print(urllib.request.urlopen(req).read().decode())
PY
)
VAULT_ID=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['vaultId'])" "$REG")
echo "  vault $VAULT_ID"

say "Starting three signers, one process each"
i=0
while read -r pid label token; do
  i=$((i+1))
  if [ -n "${SIGNERS:-}" ] && ! printf '%s' " ${SIGNERS} " | grep -q " ${label} "; then
    printf '  %-6s offline (not in SIGNERS)\n' "$label"
    continue
  fi
  MIS=""
  [ "${MISBEHAVE:-}" = "$label" ] && MIS=1
  # `env` rather than assignment prefixes: bash parses assignments before
  # expansion, so a conditional ${MIS:+VAR=1} becomes the command name
  # instead of a variable, and the signer silently never starts.
  # Two layouts. `examples/ceremony.rs` writes every share into the vault
  # root, because one process made them all. `three-party-ceremony.sh`
  # writes each into its own participant directory, because three processes
  # did — and that arrangement is itself part of the claim, so prefer it
  # when it is there.
  SHARE="$VAULT/share-$i.bin"
  PER_PARTY="$VAULT/$(printf '%s' "$label" | tr 'A-Z' 'a-z')/share-$i.bin"
  [ -f "$PER_PARTY" ] && SHARE="$PER_PARTY"

  env \
    QUORUM_COORDINATOR_URL="$URL" \
    QUORUM_SIGNER_SHARE="$SHARE" \
    QUORUM_SIGNER_PASSPHRASE="$PASSPHRASE" \
    QUORUM_SIGNER_ID="$pid" \
    QUORUM_SIGNER_TOKEN="$token" \
    QUORUM_SIGNER_LABEL="$label" \
    QUORUM_SIGNER_AUTO_APPROVE="${AUTO_APPROVE:-1}" \
    ${MIS:+QUORUM_SIGNER_MISBEHAVE=1} \
    "$BIN/quorum-signerd" >"$RUN/$label.log" 2>&1 &
  PIDS+=($!)
  printf '  %-6s pid %-7s %s%s\n' "$label" "$!" "${SHARE#"$VAULT"/}" \
    "$([ -n "$MIS" ] && echo '   ← will submit a bad share')"
done < <(python3 -c "
import json,sys
for p in json.loads(sys.argv[1])['participantTokens']:
    print(p['participantId'], p['label'], p['token'])
" "$REG")
sleep 1

say "Submitting an approval request"
APPROVAL=$(python3 - "$VAULT_ID" "$PCZT" <<'PY'
import json, sys, urllib.request, urllib.error, pathlib
body = {
    "vaultId": sys.argv[1],
    "recipientAddress": "utest1recipient",
    "amountZatoshi": "1000000",
    "pcztHex": pathlib.Path(sys.argv[2]).read_bytes().hex(),
    "signerDeadlineSecs": 120,
}
req = urllib.request.Request("http://127.0.0.1:2745/coordinator/approval/submit",
                             data=json.dumps(body).encode(),
                             headers={"content-type": "application/json"})
try:
    print(json.loads(urllib.request.urlopen(req).read())["id"])
except urllib.error.HTTPError as e:
    # The likeliest cause during a rehearsal is a PCZT built for a different
    # vault. The coordinator refuses it before any signer commits a nonce, and
    # a traceback here would bury the one sentence that explains why.
    detail = json.loads(e.read()).get("message", "no detail")
    sys.exit(f"\n  The coordinator refused the request:\n\n    {detail}\n")
PY
)
echo "  request $APPROVAL"

say "Waiting — the signers are polling"
for _ in $(seq 1 60); do
  STATUS=$(python3 - "$APPROVAL" <<'PY'
import json, sys, urllib.request
req = urllib.request.Request("http://127.0.0.1:2745/coordinator/approval/status",
                             data=json.dumps({"approvalId": sys.argv[1]}).encode(),
                             headers={"content-type": "application/json"})
s = json.loads(urllib.request.urlopen(req).read())
print(s["status"], s["signaturesCollected"],
      *(f'{x["participantLabel"]}={x["status"]}' for x in s["signerStatuses"]))
PY
)
  echo "  $STATUS"
  case "$STATUS" in APPROVED*|REJECTED*) break;; esac
  sleep 2
done

echo "  logs: $RUN"

say "Event log"
python3 - "$APPROVAL" <<'PY'
import json, sys, urllib.request, textwrap
req = urllib.request.Request("http://127.0.0.1:2745/coordinator/approval/status",
                             data=json.dumps({"approvalId": sys.argv[1]}).encode(),
                             headers={"content-type": "application/json"})
s = json.loads(urllib.request.urlopen(req).read())
for e in s["events"]:
    flag = "  ⚠" if e["culpritDetected"] else "   "
    print(f'{flag} {e["participantLabel"]:<6} {e["roundType"]:<16} {e["status"]}')
    if e.get("errorDetails"):
        print(textwrap.fill(e["errorDetails"], 76,
                            initial_indent="        ", subsequent_indent="        "))
print(f'\n  final: {s["status"]}, {s["signaturesCollected"]} signature(s)')
PY

# Fetch the authorized transaction, if one exists. Without this the demo
# ends at "APPROVED" and the transaction never leaves the coordinator.
if [ -n "${AUTHORIZED_OUT:-}" ]; then
  say "Authorized transaction"
  python3 - "$APPROVAL" "$AUTHORIZED_OUT" <<'PY'
import json, sys, urllib.request, urllib.error
req = urllib.request.Request("http://127.0.0.1:2745/coordinator/approval/authorized",
                             data=json.dumps({"approvalId": sys.argv[1]}).encode(),
                             headers={"content-type": "application/json"})
try:
    r = json.loads(urllib.request.urlopen(req).read())
except urllib.error.HTTPError as e:
    sys.exit(f"  not authorized: {json.loads(e.read()).get('message')}")
open(sys.argv[2], "w").write(r["pcztHex"])
print(f"  {r['signatureCount']} signature(s) applied → {sys.argv[2]}")
print(f"  next: {r['nextStep']}")
PY
fi

say "What just happened"
cat <<'NOTE'
  Three OS processes each unsealed exactly one share. The coordinator saw
  commitments and signature shares — neither of which is secret — and never
  a share. Below threshold the signature does not exist, and that is
  mathematics rather than a permission check in our code.
NOTE
