#!/usr/bin/env bash
set -euo pipefail

BASE="http://10.67.147.80/terminal.php"
UA="secretcomputer"
USER="admin"
JAR="cookies.txt"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

panel_headers="$tmpdir/panel.headers"
login_headers="$tmpdir/login.headers"
pin_headers="$tmpdir/pin.headers"
status_out="$tmpdir/status.json"
login_out="$tmpdir/login.json"
pin_out="$tmpdir/pin.json"

echo "[*] Bootstrapping session via panel (captures cookies)…"
curl -s -D "$panel_headers" -A "$UA" -c "$JAR" \
  "$BASE?action=panel" > /dev/null

echo
read -rsp "[?] Enter password to test for user '$USER': " PASS
echo

echo "[*] Attempting login (one try)…"
curl -s -D "$login_headers" -A "$UA" -b "$JAR" -c "$JAR" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "username=$USER&password=$PASS" \
  "$BASE?action=login" > "$login_out"

echo "[*] Probing PIN endpoint once with pin=0000 (state check only)…"
curl -s -D "$pin_headers" -A "$UA" -b "$JAR" -c "$JAR" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "pin=0000" \
  "$BASE?action=pin" > "$pin_out"

echo "[*] Fetching status…"
curl -s -A "$UA" -b "$JAR" \
  "$BASE?action=status" > "$status_out"

echo
echo "================== SUMMARY =================="
echo "[+] Login response:"
cat "$login_out"
echo
echo "[+] PIN probe response:"
cat "$pin_out"
echo
echo "[+] Status response:"
cat "$status_out"
echo

# Signals
login_setcookie="$(grep -i '^Set-Cookie:' "$login_headers" || true)"
pin_setcookie="$(grep -i '^Set-Cookie:' "$pin_headers" || true)"

echo "------------------ SIGNALS ------------------"
if [[ -n "$login_setcookie" ]]; then
  echo "[*] Login Set-Cookie observed:"
  echo "    $login_setcookie"
else
  echo "[*] Login did not set a new cookie header."
fi

if [[ -n "$pin_setcookie" ]]; then
  echo "[*] PIN Set-Cookie observed:"
  echo "    $pin_setcookie"
else
  echo "[*] PIN did not set a new cookie header."
fi

# Simple heuristics (non-exploitative)
if grep -q '"status"[[:space:]]*:[[:space:]]*"fail"' "$login_out"; then
  echo "[!] Login looks like FAIL (status=fail)."
else
  echo "[+] Login response is NOT status=fail (possible state change)."
fi

if grep -q '"attempts"[[:space:]]*:[[:space:]]*null' "$pin_out"; then
  echo "[*] PIN attempts is null (no attempt counter exposed / likely not elevated)."
else
  echo "[+] PIN attempts field changed from null (possible auth-gated behavior)."
fi

echo "============================================="
echo "[*] Cookies saved in: $JAR"

