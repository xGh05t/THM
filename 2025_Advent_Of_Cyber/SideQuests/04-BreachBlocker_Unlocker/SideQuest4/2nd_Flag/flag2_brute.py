import hashlib

phash = "03c96ceff1a9758a1ea7c3cb8d43264616949d88b5914c97bdedb1ab511a85c480d49b77c4977520ebc1b24149a1fd25c37aeb2d9042d0d05492ba5c19b23990d991560019487301ef9926d9d99a2962b5914c97bdedb1ab511a85c480d49b77c49775207dc2d45214515ff55726de5fc73d5bd5500b3e86fa6c34156f954d4435e838f6852c6476217104207dc2d45214515ff55726de5fc73d5bd5500b3e86504fa1cfe6a6f5d5c407f673dd67d71a34cbb0772c21afa8b8f0b5e1c1a377b7168e542ea41f67a696e4c3dda73fa679990918ab333b6fab8c8e5f2296e56d15f089c659a1bbc1d2b6f70b6c80720f1a"

strings = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM!@#$*_-"


def hopper_hash(s):
    res = s
    for i in range(1000):
        res = hashlib.sha1(res.encode()).hexdigest()
    return res


for i in range(0, len(phash), 40):
    char_hash = phash[i:i+40]

    for ch in strings:
        if hopper_hash(ch) == char_hash:
            print(ch, end="")
            break
