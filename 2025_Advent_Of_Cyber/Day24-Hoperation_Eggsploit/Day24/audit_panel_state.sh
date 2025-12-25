#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://10.67.147.80/terminal.php}"
UA="${UA:-secretcomputer}"
USER="${USER:-admin}"
JAR="${JAR:-cookies.txt}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PANEL_H="$TMP/panel.headers"
LOGIN_H="$TMP/login.headers"
PIN_H="$TMP/pin.headers"

PANEL_B="$TMP/panel.body"
LOGIN_B="$TMP/login.body"
PIN_B="$TMP/pin.body"
STATUS_B="$TMP/status.body"

COOKIE_BEFORE="$TMP/cookies.before"
COOKIE_AFTER="$TMP/cookies.after"

hash_file() { sha256sum "$1" | awk '{print $1}'; }

echo "[*] Target : $BASE"
echo "[*] UA     : $UA"
echo "[*] User   : $USER"
echo "[*] Cookie : $JAR"
echo

# Snapshot existing cookie jar (if any)
if [[ -f "$JAR" ]]; then
  cp "$JAR" "$COOKIE_BEFORE"
else
  : > "$COOKIE_BEFORE"
fi

echo "[1/4] Bootstrapping session via panel (cookie + baseline response)…"
curl -sS -D "$PANEL_H" -A "$UA" -c "$JAR" \
  "$BASE?action=panel" > "$PANEL_B"

echo "[2/4] Login (ONE attempt; you enter password)…"
read -rsp "Password for '$USER': " PASS
echo

curl -sS -D "$LOGIN_H" -A "$UA" -b "$JAR" -c "$JAR" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "username=$USER&password=$PASS" \
  "$BASE?action=login" > "$LOGIN_B"

echo "[3/4] PIN probe (ONE attempt with pin=0000; state check only)…"
curl -sS -D "$PIN_H" -A "$UA" -b "$JAR" -c "$JAR" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "pin=0000" \
  "$BASE?action=pin" > "$PIN_B"

echo "[4/4] Status check…"
curl -sS -A "$UA" -b "$JAR" \
  "$BASE?action=status" > "$STATUS_B"

cp "$JAR" "$COOKIE_AFTER" 2>/dev/null || :


echo
echo "==================== RESULTS ===================="

echo "[Panel]  HTTP Set-Cookie:"
grep -i '^Set-Cookie:' "$PANEL_H" || echo "  (none)"
echo

echo "[Login]  Body:"
cat "$LOGIN_B"
echo

echo "[PIN]    Body:"
cat "$PIN_B"
echo

echo "[Status] Body:"
cat "$STATUS_B"
echo

echo "-------------------- SIGNALS --------------------"

# Cookie deltas
echo "[Cookies] Delta (before -> after):"
if command -v diff >/dev/null 2>&1; then
  diff -u "$COOKIE_BEFORE" "$COOKIE_AFTER" || true
else
  echo "  (diff not available)"
fi
echo

# Response hashes (quick “did anything change?” indicators)
echo "[Hashes] panel=$(hash_file "$PANEL_B") login=$(hash_file "$LOGIN_B") pin=$(hash_file "$PIN_B") status=$(hash_file "$STATUS_B")"
echo

# Login fail check
if grep -q '"status"[[:space:]]*:[[:space:]]*"fail"' "$LOGIN_B"; then
  echo "[Login]  status=fail detected"
else
  echo "[Login]  status != fail (POSSIBLE SUCCESS/STATE CHANGE)"
fi

# PIN attempts check
if grep -q '"attempts"[[:space:]]*:[[:space:]]*null' "$PIN_B"; then
  echo "[PIN]    attempts=null (no attempt counter exposed / likely not elevated)"
else
  echo "[PIN]    attempts != null (STATE CHANGE / gating behavior changed)"
fi

# Token-like extraction (best-effort, no jq required)
echo
echo "[Token scan] Looking for token-like fields in login/pin responses:"
grep -Eoi '"(token|operator_token|admin_token|jwt)"[[:space:]]*:[[:space:]]*"[^"]+"' "$LOGIN_B" "$PIN_B" 2>/dev/null \
  || echo "  (none found)"
echo

echo "------------------- NEXT STEP -------------------"
echo "If you ever see:"
echo "  - Login response NOT status=fail, OR"
echo "  - PIN attempts field changes, OR"
echo "  - Any token field appears"
echo "Stop testing passwords and move to the token/close phase."
echo "================================================="

