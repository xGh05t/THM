from flask import Flask, request, jsonify, send_from_directory, session
import time
import random
import os
import hashlib
import time
import smtplib
import sqlite3
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import base64

connection = sqlite3.connect("/hopflix-874297.db")
cursor = connection.cursor()

connection2 = sqlite3.connect("/hopsecbank-12312497.db")
cursor2 = connection2.cursor()

app = Flask(__name__)
app.secret_key = os.getenv('SECRETKEY')

aes_key = bytes(os.getenv('AESKEY'), "utf-8")

# Credentials (server-side only)
HOPFLIX_FLAG = os.getenv('HOPFLIX_FLAG')
BANK_ACCOUNT_ID = "hopper"
BANK_PIN = os.getenv('BANK_PIN')
BANK_FLAG = os.getenv('BANK_FLAG')
#CODE_FLAG = THM{eggsposed_source_code}

def encrypt(plaintext):
    cipher = AES.new(aes_key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext.encode('utf-8'))
    return base64.b64encode(cipher.nonce + tag + ciphertext).decode('utf-8')

def decrypt(encrypted_data):
    decoded_data = base64.b64decode(encrypted_data.encode('utf-8'))
    nonce_len = 16
    tag_len = 16
    nonce = decoded_data[:nonce_len]
    tag = decoded_data[nonce_len:nonce_len + tag_len]
    ciphertext = decoded_data[nonce_len + tag_len:]

    cipher = AES.new(aes_key, AES.MODE_GCM, nonce=nonce)
    plaintext_bytes = cipher.decrypt_and_verify(ciphertext, tag)
    return plaintext_bytes.decode('utf-8')

def validate_email(email):
    if '@' not in email:
        return False
    if any(ord(ch) <= 32 or ord(ch) >=126 or ch in [',', ';'] for ch in email):
        return False

    return True

def send_otp_email(otp, to_addr):
    if not validate_email(to_addr):
        return -1

    allowed_emails= session['bank_allowed_emails']
    allowed_domains= session['bank_allowed_domains']
    domain = to_addr.split('@')[-1]
    if domain not in allowed_domains and to_addr not in allowed_emails:
        return -1

    from_addr = 'no-reply@hopsecbank.thm'
    message = f"""\
    Subject: Your OTP for HopsecBank

    Dear you,
    The OTP to access your banking app is {otp}.

    Thanks for trusting Hopsec Bank!"""

    s = smtplib.SMTP('smtp')
    s.sendmail(from_addr, to_addr, message)
    s.quit()


def hopper_hash(s):
    res = s
    for i in range(5000):
        res = hashlib.sha1(res.encode()).hexdigest()
    return res

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/check-credentials', methods=['POST'])
def check_credentials():
    data = request.json
    email = str(data.get('email', ''))
    pwd = str(data.get('password', ''))
    
    rows = cursor.execute(
        "SELECT * FROM users WHERE email = ?",
        (email,),
    ).fetchall()

    if len(rows) != 1:
        return jsonify({'valid':False, 'error': 'User does not exist'})
    
    phash = rows[0][2]
    
    if len(pwd)*40 != len(phash):
        return jsonify({'valid':False, 'error':'Incorrect Password'})

    for ch in pwd:
        ch_hash = hopper_hash(ch)
        if ch_hash != phash[:40]:
            return jsonify({'valid':False, 'error':'Incorrect Password'})
        phash = phash[40:]
    
    session['authenticated'] = True
    session['username'] = email
    return jsonify({'valid': True})

@app.route('/api/get-last-viewed', methods=['GET'])
def get_bank_account_id():
    if not session.get('authenticated', False):
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({'last_viewed': HOPFLIX_FLAG})

@app.route('/api/bank-login', methods=['POST'])
def bank_login():
    data = request.json
    account_id = str(data.get('account_id', ''))
    pin = str(data.get('pin', ''))
    
    # Check bank credentials
    rows = cursor2.execute(
        "SELECT * FROM users WHERE email = ?",
        (account_id,),
    ).fetchall()

    if len(rows) != 1:
        return jsonify({'valid':False, 'error': 'User does not exist'})
    
    phash = rows[0][2]
    if hashlib.sha256(pin.encode()).hexdigest().lower() == phash:
        session['bank_authenticated'] = True
        session['bank_2fa_verified'] = False
        session['bank_allowed_emails'] = rows[0][5].split(',')
        session['bank_allowed_domains'] = rows[0][6].split(',')
        
        if len(session['bank_allowed_emails']) > 0:
            return jsonify({
                'success': True,
                'requires_2fa': True,
                'trusted_emails': rows[0][5].split(','),
            })
        if len(session['bank_allowed_domains']) > 0:
            return jsonify({
                'success': True,
                'requires_2fa': True,
                'trusted_domains': rows[0][6].split(','),
            })
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/send-2fa', methods=['POST'])
def send_2fa():
    data = request.json
    otp_email = str(data.get('otp_email', ''))
    
    if not session.get('bank_authenticated', False):
        return jsonify({'error': 'Access denied.'}), 403
    
    # Generate 2FA code
    two_fa_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    session['bank_2fa_code'] = encrypt(two_fa_code)

    if send_otp_email(two_fa_code, otp_email) != -1:
        return jsonify({'success': True})
    else:
        return jsonify({'success': False})

@app.route('/api/verify-2fa', methods=['POST'])
def verify_2fa():
    data = request.json
    code = str(data.get('code', ''))
    
    if not session.get('bank_authenticated', False):
        return jsonify({'error': 'Access denied.'}), 403
    
    if not session.get('bank_2fa_code', False):
        return jsonify({'error': 'No 2FA code generated'}), 404
    
    if code == decrypt(session.get('bank_2fa_code')):
        session['bank_2fa_verified'] = True
        return jsonify({'success': True})
    else:
        if 'bank_2fa_code' in session:
            del session['bank_2fa_code']
        return jsonify({'error': 'Invalid code'}), 401

@app.route('/api/release-funds', methods=['POST'])
def release_funds():
    if not session.get('bank_authenticated', False):
        return jsonify({'error': 'Access denied.'}), 403
    if not session.get('bank_2fa_verified', False):
        return jsonify({'error': 'Access denied.'}), 403
    
    return jsonify({'flag': BANK_FLAG})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True,threaded=True)

