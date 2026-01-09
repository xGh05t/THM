
# 🧩 Day 17 – CyberChef: Hoperation Save McSkidy

**Platform**: TryHackMe – *Advent of Cyber 2025*  
**Focus**: CyberChef decoding, Base64, XOR, MD5, ROT13, reverse engineering HTTP headers

---

## 🧠 Scenario

McSkidy is trapped in King Malhare's Quantum Warren. Sir BreachBlocker III locked down five layers of defense, each requiring a decoding challenge. Hidden clues in HTTP headers help bypass each lock using CyberChef and logic.

---

## 🗝️ Lock Credentials Breakdown

| Lock # | Lock Name       | Username (Decoded) | Password |
|--------|------------------|--------------------|----------|
| 1      | Outer Gate       | CottonTail         | Iamsofluffy |
| 2      | Outer Wall       | CarrotHelm         | Itoldyoutochangeit! |
| 3      | Guard House      | LongEars           | BugsBunny |
| 4      | Inner Castle     | Lenny              | passw0rd1 |
| 5      | Prison Tower     | Carl               | 51rBr34chBl0ck3r |

---

## 🔐 First Lock – Outer Gate

**URL**: `http://10.67.161.32:8080/level1`  
**Header Clue**:  
- `X-Magic-Question`: `"What is the password for this level?"`
- Response (Base64):  
  `SWFtc29mbHVmZnk=` → `Iamsofluffy`

**Credentials**:
```txt
Username: Q290dG9uVGFpbA== → CottonTail  
Password: Iamsofluffy
```

---

## 🔐 Second Lock – Outer Wall

**URL**: `http://10.67.161.32:8080/level2`  
**Header Clue**:
- `X-Magic-Question`: `"Did you change the password?"`
- Response (Base64):  
  `U1hSdmJHUjViM1YwYjJOb1lXNW5aV2wwSVE9PQ==` → `Itoldyoutochangeit!`

**Credentials**:
```txt
Username: Q2Fycm90SGVsbQ== → CarrotHelm  
Password: Itoldyoutochangeit!
```

---

## 🔐 Third Lock – Guard House

**URL**: `http://10.67.175.30:8080/level3`  
**Header Clue**:
- `X-Recipe-Key`: `cyberchef`
- Response (Base64 → XOR with key `cyberchef`):  
  `IQwFFjAWBgsf` → `BugsBunny`

**Credentials**:
```txt
Username: TG9uZ0VhcnM= → LongEars  
Password: BugsBunny
```

---

## 🔐 Fourth Lock – Inner Castle

**URL**: `http://10.67.175.30:8080/level4`  
**Header Clue**:
- Response (Base64): `b4c0be7d7e97ab74c13091b76825cf39`

Using CrackStation:
- MD5 hash → `passw0rd1`

**Credentials**:
```txt
Username: TGVubnk= → Lenny  
Password: passw0rd1
```

---

## 🔐 Fifth Lock – Prison Tower

**URL**: `http://10.67.175.30:8080/level5`  
**Header Clues**:
- `X-Recipe-ID`: `R1`
- `X-Recipe-Key`: `cyberchef`

**Decoding steps**:
- Base64: `ZTN4cDB5T3VwNDNlT2UxNQ==` → `e3xp0yOup43eOe15`
- Reverse: `51eOe34puOy0px3e`
- ROT13: `51rBr34chBl0ck3r`

**Credentials**:
```txt
Username: Q2FybA== → Carl  
Password: 51rBr34chBl0ck3r
```

---

## 🏁 Final Flag

```txt
THM{M3D13V4L_D3C0D3R_4D3P7}
```

✅ McSkidy has escaped thanks to your decoding mastery!

---

## ✅ Completion Timestamp

```txt
2025-12-22 19:09:26 EST -- COMPLETE
```
