
# 🕵️ Day 15 – Web-Attack Forensics: Drone Alone

**Platform**: TryHackMe – *Advent of Cyber 2025*  
**Focus**: Splunk forensics, web attack analysis, command injection, PowerShell detection, process tracing

---

## 🎯 Target Info

```txt
Target IP: 10.66.133.65
Splunk URL: http://10.66.133.65:8000
```

🧑‍💻 **Login Credentials**
```txt
Username: Blue
Password: Pass1234
```

---

## 🧭 Steps & Queries

### 1. Detect Suspicious Web Commands

**Splunk Query:**
```spl
index=windows_apache_access (cmd.exe OR powershell OR "powershell.exe" OR "Invoke-Expression") 
| table _time host clientip uri_path uri_query status
```

🟡 Sample Match:
```
/cgi-bin/hello.bat?cmd=powershell.exe+-enc+VABoAGkAcwAgAGkAcwAgAG4AbwB3ACAATQBpAG4AZQAhACAATQBVAEEASABBAEEASABBAEEA
```

🧠 Decoded Base64:
```bash
echo 'VABoAGkAcwAgAGkAcwAgAG4AbwB3ACAATQBpAG4AZQAhACAATQBVAEEASABBAEEASABBAEEA' | base64 -d
# Output: This is now Mine! MUAHAAHAA
```

---

### 2. Investigate Apache Error Logs

**Splunk Query:**
```spl
index=windows_apache_error ("cmd.exe" OR "powershell" OR "Internal Server Error")
```

🔍 Finding:
```
AH01215: 'powershell.exe+-enc+...' is not recognized as an internal or external command
```

📌 Indicates failed command injection attempt due to unrecognized command.

---

### 3. Trace Suspicious Process Creation

**Splunk Query:**
```spl
index=windows_sysmon ParentImage="*httpd.exe"
```

🧪 Identified Behavior:
- Apache spawned: `cmd.exe`
- `cmd.exe` ran PowerShell — clear sign of successful injection.

---

### 4. Confirm Enumeration by Attacker

**Splunk Query:**
```spl
index=windows_sysmon *cmd.exe* *whoami*
```

🧠 Finding:
```txt
Process: whoami.exe
Parent: cmd.exe → C:\Windows\system32\cmd.exe /C ""C:\Apache24\cgi-bin\hello.bat""
User: WEBAPPSERVER\apache_svc
```

🟩 Indicates post-exploitation enumeration via `whoami`.

---

### 5. Search for Encoded PowerShell Commands

**Splunk Query:**
```spl
index=windows_sysmon Image="*powershell.exe" (CommandLine="*enc*" OR CommandLine="*-EncodedCommand*" OR CommandLine="*Base64*")
```

🔕 No results were returned — likely all payloads executed inline or failed.

---

## 📝 Questions & Answers

1. **What is the reconnaissance executable file name?**  
   `whoami.exe`

2. **What executable did the attacker attempt to run through the command injection?**  
   `powershell.exe`

---

## ✅ Completion Timestamp

```txt
2025-12-22 11:17:17 EST -- COMPLETE
```
