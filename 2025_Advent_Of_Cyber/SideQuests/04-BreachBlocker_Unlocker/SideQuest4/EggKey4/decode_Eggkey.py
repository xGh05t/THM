import re,base64
from pathlib import Path

h = Path("NorthPolePerformanceReview.hta").read_text("latin1","ignore")
c = h[re.search(r'\bp\s*=\s*["\']',h,re.I).end():re.search(r'\bf\.Write\b',h,re.I).start()]
p = base64.b64decode("".join(re.findall(r"[A-Za-z0-9+/=]",c))).decode(errors="ignore")

k = int(re.search(r'\$k\s*=\s*(\d+)',p).group(1))
d = base64.b64decode(re.search(r"\$d\s*=\s*'([^']+)'",p,re.S).group(1))
x = bytes(b^k for b in d)

s = x.find(b"\x89PNG\r\n\x1a\n"); e=x.find(b"\x00\x00\x00\x00IEND\xaeB`\x82",s)+12
Path("sq4.png").write_bytes(x[s:e])
