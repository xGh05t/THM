# Stage 03: Blue Team

Log Entry:
198.51.100.22 - - [03/Oct/2025:09:03:11 +0100] "POST /login.php HTTP/1.1" 200 642 "-" "python-requests/2.31.0" "username=alice%27+OR+1%3D1+--+-&password=test"

---

### 1. Analysis of the Logs
- IP Address: The attacker used an IP address to access the web server.
- Time and Date: The attack occurred on 3 October 2025 at 09:03.
- URL: The URL accessed was /login.php, which is a typical login endpoint.
- Username Attempted: The username alice was used, with an SQL injection attempt in the password parameter.
- SQL Injection: The log shows 'alice' OR 1=1 in the password field, indicating that the application was vulnerable to SQL injection.
- Blue Team Perspective: Detecting such attacks helps identify potential security weaknesses in the system. It highlights the importance of monitoring logs to detect and mitigate vulnerabilities. 
