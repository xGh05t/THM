
# 🧬 Day 16 – Forensics: Registry Furensics

**Platform**: TryHackMe – *Advent of Cyber 2025*  
**Focus**: Windows Registry analysis, USB device artifacts, application execution, persistence mechanisms

---

## 🎯 Target Info

```txt
Target IP: 10.67.191.248
Port: 3389 (RDP)
```

🧑‍💻 **RDP Credentials**
```txt
Username: Administrator
Password: Aoc_RegistryForensics456
```

---

## 📡 Initial Scan & RDP Access

### Nmap Scan

```bash
nmap -Pn 10.67.191.248
```

Output:
```
3389/tcp open  ms-wbt-server
```

### RDP Login

```bash
xfreerdp3 /sec:nla /cert:ignore /v:10.67.191.248:3389 \
  /u:Administrator /p:Aoc_RegistryForensics456 \
  /drive:Public,. /client-hostname:HAX /clipboard /audio-mode:2 /themes /wallpaper
```

---

## 🧠 Registry Concepts

- Windows Registry = Configuration brain of the OS
- Stored across several **hive files**
- Viewed via **Registry Editor** or forensic tools like **Registry Explorer**

---

## 🗂️ Example: USB Device Artifacts

**Hive**: `SYSTEM`  
**Path**:  
```
HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Enum\USBSTOR
```

📌 Shows:
- Device make/model
- Unique device ID

---

## 🧰 Example: Programs Run (via Run Dialog)

**Hive**: `NTUSER.DAT`  
**Path**:  
```
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU
```

📌 Shows:
- Commands launched via `Win + R`

---

## 🔎 Forensic Analysis Tool

Use **Registry Explorer** (open-source) to:
- Parse offline hive files
- Decode binary keys
- Avoid modifying live system data

📌 Tip: Hold **SHIFT** while opening a hive to ensure clean load state.

---

## 📝 Investigation Findings

🕵️ Abnormal activity began on: `October 21, 2025`

---

### 1. What application was installed before abnormal activity?

**Hive**: `SOFTWARE`  
**Path**:  
```
Microsoft\Windows\CurrentVersion\Uninstall
```

🟩 **Answer**: `DroneManager updater`

---

### 2. Full path where user launched the application?

**Hive**: `NTUSER.DAT`  
**Path**:  
```
Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store
```

🟩 **Answer**:  
```txt
C:\Users\dispatch.admin\Downloads\DroneManager_Setup.exe
```

---

### 3. Persistence mechanism via startup?

**Hive**: `SOFTWARE`  
**Path**:  
```
Microsoft\Windows\CurrentVersion\Run
```

🟩 **Answer**:  
```txt
"C:\Program Files\DroneManager\dronehelper.exe" --background
```

---

## ✅ Completion Timestamp

```txt
2025-12-22 14:17:26 EST -- COMPLETE
```
