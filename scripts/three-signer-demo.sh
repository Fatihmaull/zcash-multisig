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
#
# Pass HAND=<label> to leave that signer to a person: the script writes its
# credentials to $QUORUM_DEMO_LOGS/<label>.env (mode 0600, never printed), and
# the person starts quorum-signerd in their own terminal with the prompt on.
# Combine with SIGNERS naming the scripted signer(s), e.g.
#   HAND=Alice SIGNERS="Bob" QUORUM_DEMO_LOGS=/tmp/q-beat4 ./scripts/three-signer-demo.sh <vault> <pczt>
#   # other terminal:  set -a; . /tmp/q-beat4/Alice.env; set +a
#   #                  QUORUM_SIGNER_PASSPHRASE="$QUORUM_DEV_PASSPHRASE" packages/core/target/release/quorum-signerd
#
# VAULT_LABEL overrides the name registered with the coordinator, which is
# what the approval request then shows. Unset or empty, it is the vault
# directory's basename — ./secrets/ceremony registers as "ceremony".

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

# Word-match a label against a space-separated list. "Bob" does not match "Bobby".
listed() {
  printf '%s' " ${2} " | grep -F -q " ${1} "
}

join_by() {
  local sep="$1"
  shift
  local out="" item
  for item in "$@"; do
    if [ -z "$out" ]; then out="$item"; else out="${out}${sep}${item}"; fi
  done
  printf '%s' "$out"
}

count_word() {
  local w
  case "$1" in
    1) w=one;;
    2) w=two;;
    3) w=three;;
    *) w="$1";;
  esac
  if [ "${2:-}" = cap ]; then
    printf '%s%s' "$(printf '%s' "${w:0:1}" | tr '[:lower:]' '[:upper:]')" "${w:1}"
  else
    printf '%s' "$w"
  fi
}

# Fill HAND_NAMES, UNSEALED, and SEALED in roster order from "id label token"
# rows. A HAND signer counts as unsealed: that process is a person's, and it
# still opens exactly one share. Anyone the script does not start stays sealed.
classify_signers() {
  HAND_NAMES=()
  UNSEALED=()
  SEALED=()
  local row _pid label _token
  for row in "$@"; do
    read -r _pid label _token <<<"$row"
    if [ -n "${HAND:-}" ] && listed "$label" "$HAND"; then
      HAND_NAMES+=("$label")
      UNSEALED+=("$label")
    elif [ -z "${SIGNERS:-}" ] || listed "$label" "$SIGNERS"; then
      UNSEALED+=("$label")
    else
      SEALED+=("$label")
    fi
  done
}

starting_line() {
  local n=${#UNSEALED[@]}
  local line
  if [ "$n" -eq 0 ]; then
    line="Starting no signers"
  elif [ "$n" -eq 1 ]; then
    line="Starting one signer, one process"
  else
    line="Starting $(count_word "$n") signers, one process each"
  fi
  if [ ${#HAND_NAMES[@]} -gt 0 ]; then
    line="${line} ($(join_by ", " "${HAND_NAMES[@]}") by hand)"
  fi
  printf '%s' "$line"
}

unsealed_lead() {
  local n=${#UNSEALED[@]}
  local lead
  if [ "$n" -eq 0 ]; then
    lead="No OS process unsealed a share."
  elif [ "$n" -eq 1 ]; then
    lead="One OS process (${UNSEALED[0]}) unsealed exactly one share."
  else
    lead="$(count_word "$n" cap) OS processes ($(join_by ", " "${UNSEALED[@]}")) each unsealed exactly one share."
  fi
  local sealed_n=${#SEALED[@]}
  if [ "$sealed_n" -eq 1 ]; then
    lead="${lead} ${SEALED[0]}'s share was never unsealed."
  elif [ "$sealed_n" -gt 1 ]; then
    local last_i=$((sealed_n - 1))
    local last="${SEALED[$last_i]}"
    local possessives=() i
    for ((i = 0; i < last_i; i++)); do
      possessives+=("${SEALED[$i]}'s")
    done
    if [ "$sealed_n" -eq 2 ]; then
      lead="${lead} ${possessives[0]} and ${last}'s shares were never unsealed."
    else
      lead="${lead} $(join_by ", " "${possessives[@]}"), and ${last}'s shares were never unsealed."
    fi
  fi
  printf '%s' "$lead"
}

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
REG=$(python3 - "$VAULT" "$URL" <<'PY'
import json, os, sys, urllib.request, pathlib
d = pathlib.Path(sys.argv[1])
base = sys.argv[2].rstrip("/")
body = {
    "label": os.environ.get("VAULT_LABEL") or d.resolve().name,
    "threshold": 2,
    "address": (d / "vault-address.txt").read_text().strip(),
    "publicKeyPackage": json.loads((d / "public-key-package.json").read_text()),
    "participants": json.loads((d / "participants.json").read_text()),
}
req = urllib.request.Request(base + "/coordinator/vault/register",
                             data=json.dumps(body).encode(),
                             headers={"content-type": "application/json"})
print(urllib.request.urlopen(req).read().decode())
PY
)
VAULT_ID=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['vaultId'])" "$REG")
echo "  vault $VAULT_ID"

mapfile -t ROWS < <(python3 -c "
import json,sys
for p in json.loads(sys.argv[1])['participantTokens']:
    print(p['participantId'], p['label'], p['token'])
" "$REG")
classify_signers "${ROWS[@]}"
say "$(starting_line)"
i=0
for row in "${ROWS[@]}"; do
  read -r pid label token <<<"$row"
  i=$((i+1))
  # HAND=<label>: this participant is run by a person, in their own terminal,
  # with the approval prompt on. The script does not start it; it writes the
  # participant's coordinator credentials to a 0600 file instead of printing
  # them, so the bearer token never appears on screen.
  if [ -n "${HAND:-}" ] && listed "$label" "$HAND"; then
    SHARE="$VAULT/share-$i.bin"
    PER_PARTY="$VAULT/$(printf '%s' "$label" | tr 'A-Z' 'a-z')/share-$i.bin"
    [ -f "$PER_PARTY" ] && SHARE="$PER_PARTY"
    # Absolute, so the hand-run signer does not depend on the directory it
    # is started from. The scripted signers stay relative: they are children
    # of this process and inherit its cwd.
    SHARE_ABS="$(CDPATH= cd "$(dirname "$SHARE")" && pwd)/$(basename "$SHARE")"
    ENVF="$RUN/$label.env"
    ( umask 077
      printf 'QUORUM_COORDINATOR_URL=%s\nQUORUM_SIGNER_SHARE=%s\nQUORUM_SIGNER_ID=%s\nQUORUM_SIGNER_TOKEN=%s\nQUORUM_SIGNER_LABEL=%s\n' \
        "$URL" "$SHARE_ABS" "$pid" "$token" "$label" >"$ENVF" )
    printf '  %-6s by hand, prompt on — credentials in %s (not printed)\n' "$label" "$ENVF"
    continue
  fi
  if [ -n "${SIGNERS:-}" ] && ! listed "$label" "$SIGNERS"; then
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
done
sleep 1

say "Submitting an approval request"
APPROVAL=$(python3 - "$VAULT_ID" "$PCZT" "$URL" <<'PY'
import json, os, sys, urllib.request, urllib.error, pathlib
# What the proposer CLAIMS. Signers show it in the "not verified" column; set
# it to what the PCZT was actually built with so the two columns agree.
base = sys.argv[3].rstrip("/")
body = {
    "vaultId": sys.argv[1],
    "recipientAddress": os.environ.get("CLAIMED_RECIPIENT", "utest1recipient"),
    "amountZatoshi": os.environ.get("CLAIMED_AMOUNT_ZAT", "1000000"),
    "pcztHex": pathlib.Path(sys.argv[2]).read_bytes().hex(),
    "signerDeadlineSecs": 120,
}
req = urllib.request.Request(base + "/coordinator/approval/submit",
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
  STATUS=$(python3 - "$APPROVAL" "$URL" <<'PY'
import json, sys, urllib.request
base = sys.argv[2].rstrip("/")
req = urllib.request.Request(base + "/coordinator/approval/status",
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
python3 - "$APPROVAL" "$URL" <<'PY'
import json, sys, urllib.request, textwrap
base = sys.argv[2].rstrip("/")
req = urllib.request.Request(base + "/coordinator/approval/status",
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
  python3 - "$APPROVAL" "$AUTHORIZED_OUT" "$URL" <<'PY'
import json, sys, urllib.request, urllib.error
base = sys.argv[3].rstrip("/")
req = urllib.request.Request(base + "/coordinator/approval/authorized",
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
# Who unsealed a share, including a HAND signer. The rest of the paragraph is fixed.
cat <<NOTE
  $(unsealed_lead) The coordinator saw
  commitments and signature shares — neither of which is secret — and never
  a share. Below threshold the signature does not exist, and that is
  mathematics rather than a permission check in our code.
NOTE
