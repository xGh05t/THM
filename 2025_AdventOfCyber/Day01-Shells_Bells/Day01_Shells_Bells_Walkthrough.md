
# 🐚 Day 01 – Shells Bells: Linux CLI Walkthrough

**Platform**: TryHackMe – *Advent of Cyber 2025*  
**Focus**: Linux CLI, log analysis, hidden files, GPG decryption, base64 ciphertext, Easter egg puzzles  

---

## 🔐 Credentials

```txt
Username: mcskidy
Password: AoC2025!

Username: eddi_knapp
Password: S0mething1Sc0ming
```

---

## 🏁 Flags Collected

```txt
THM{learning-linux-cli}
THM{sir-carrotbane-attacks}
THM{until-we-meet-again}
THM{w3lcome_2_A0c_2025}
```

---

## 🧩 Side Quest: Fragments + Egg

```txt
PASSFRAG1: 3ast3r  
PASSFRAG2: -1s-  
PASSFRAG3: c0M1nG  

Combined Passphrase: 3ast3r-1s-c0M1nG  

SideQuest EggKey #1: now_you_see_me
```

---

## 📜 Step-by-Step Guide

---

### 1. Connect to Machine

```bash
ssh mcskidy@10.67.188.34
# Password: AoC2025!
```

---

### 2. Read Initial Clue

```bash
cat README.txt
```

> Notes suspicious server activity and mentions a hidden guide.

---

### 3. Find the Hidden Guide

```bash
ls -lah ~/Guides
cat ~/Guides/.guide.txt
```

> Contains instructions to check `/var/log` for egg-related entries.

---

### 4. Investigate Logs

```bash
egrep -Ri 'egg' /var/log 2>/dev/null | egrep -i 'failed'
```

> Output shows repeated failed SSH logins for `socmas` from `eggbox-196.hopsec.thm`.

---

### 5. Discover Malicious Script

```bash
sudo find /home/socmas -name "*egg*" 2>/dev/null
# /home/socmas/2025/eggstrike.sh

cat /home/socmas/2025/eggstrike.sh
```

> A malicious script modifies `wishlist.txt`.

🟩 **Flag**: `THM{sir-carrotbane-attacks}`

---

### 6. Root Escalation & Log Review

```bash
sudo su -
history
```

🟩 **Flag found in bash history**: `THM{until-we-meet-again}`

---

## 🥚 Side Quest: Hopper’s Origin

---

### 1. Read Side Quest Message

```bash
cat ~/Documents/read-me-please.txt
```

> Clues point to hidden "PASSFRAG" values across dotfiles, git repos, and image metadata.

---

### 2. Access `eddi_knapp` Account

```bash
ssh eddi_knapp@10.67.188.34
# Password: S0mething1Sc0ming
```

---

### 3. Clue 1 – .bashrc (PASSFRAG1)

```bash
less ~/.bashrc
# export PASSFRAG1="3ast3r"
```

---

### 4. Clue 2 – Hidden Git Repo (PASSFRAG2)

```bash
cd ~/.secret_git
git log -p
# PASSFRAG2: -1s-
```

---

### 5. Clue 3 – Hidden File in Pictures (PASSFRAG3)

```bash
cd ~/Pictures
find . -exec egrep "PASSFRAG+" {} + 2>/dev/null
cat .easter_egg
# PASSFRAG3: c0M1nG
```

---

### 6. Combine Fragments

```txt
Combined: 3ast3r-1s-c0M1nG
```

---

### 7. Decrypt McSkidy’s GPG Note

```bash
gpg --batch --yes --pinentry-mode=loopback --passphrase "3ast3r-1s-c0M1nG" -d ~/Documents/mcskidy_note.txt.gpg
```

> Reveals the **correct wishlist** + **unlock key** for ciphertext decryption.

🟩 **UNLOCK_KEY**: `91J6X7R4FQ9TQPM9JX2Q9X2Z`

---

### 8. Fix the `wishlist.txt`

```bash
cd /home/socmas/2025
cp wishlist.txt wishlist.txt.bak

cat << 'EOF' > wishlist.txt
Hardware security keys (YubiKey or similar)
Commercial password manager subscriptions (team seats)
Endpoint detection & response (EDR) licenses
Secure remote access appliances (jump boxes)
Cloud workload scanning credits (container/image scanning)
Threat intelligence feed subscription

Secure code review / SAST tool access
Dedicated secure test lab VM pool
Incident response runbook templates and playbooks
Electronic safe drive with encrypted backups
EOF
```

---

### 9. Decrypt Website Ciphertext

```bash
# Copy base64 ciphertext from http://10.67.129.18:8080/
echo "BASE64_DATA" > website_output.txt

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -salt -base64 -in website_output.txt -out decoded_message.txt -pass pass:'91J6X7R4FQ9TQPM9JX2Q9X2Z'

cat decoded_message.txt
```

🟩 **Flag**: `THM{w3lcome_2_A0c_2025}`  
Also reveals instructions for the sidequest archive.

---

## 🔓 Bonus: SideQuest Archive

---

### 10. Decrypt Hidden Archive

```bash
cd /home/eddi_knapp/.secret

# Copy archive locally (optional)
scp dir.tar.gz.gpg kali@<your_ip>:/home/kali/

# Decrypt
gpg --batch --yes --pinentry-mode=loopback --passphrase 'THM{w3lcome_2_A0c_2025}' -o dir.tar.gz -d dir.tar.gz.gpg

# Extract
tar -xzf dir.tar.gz
```

---

### 11. Reveal SideQuest Egg

```bash
ls -lah dir/
display dir/sq1.png
```

> 🥚 **EggKey #1**: `now_you_see_me`

---

## ✅ Summary

- 🎯 Gained CLI proficiency  
- 🔍 Investigated logs and scripts  
- 🔐 Decrypted messages via GPG/OpenSSL  
- 🥚 Completed a hidden Easter egg quest  

---
