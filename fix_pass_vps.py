import paramiko

def fix_password():
    hostname = "72.62.120.102"
    username = "root"
    password = "passwordE@25"

    print("[*] Connecting to VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname, username=username, password=password, timeout=10)
    
    script = """
echo "[*] Generating proper bcrypt hash and updating DB..."
/var/www/bewa/venv/bin/python3 -c "
import bcrypt
import mysql.connector

try:
    # Proper bcrypt hash for 'admin123'
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(b'admin123', salt).decode('utf-8')
    
    conn = mysql.connector.connect(
        host='localhost',
        user='bewa_user',
        password='bewa_pass_2026',
        database='bewa_logistics'
    )
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET password_hash = %s WHERE username = %s', (hashed, 'admin'))
    conn.commit()
    print('[+] Password hash successfully updated in database.')
except Exception as e:
    print(f'[-] Error updating hash: {e}')
"
"""

    stdin, stdout, stderr = client.exec_command(script, get_pty=True)
    
    for line in iter(stdout.readline, ""):
        print(line, end="")

    client.close()

if __name__ == "__main__":
    fix_password()
