import paramiko

def fix_env():
    hostname = "72.62.120.102"
    username = "root"
    password = "passwordE@25"

    print("[*] Connecting to VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname, username=username, password=password, timeout=10)
    
    script = """
echo "VITE_API_BASE_URL=" > /var/www/bewa/web/frontend/.env

echo "[*] Rebuilding frontend with new .env..."
cd /var/www/bewa/web/frontend
npm run build

echo "[*] Restarting services..."
systemctl restart bewa
systemctl restart nginx
"""

    stdin, stdout, stderr = client.exec_command(script, get_pty=True)
    
    for line in iter(stdout.readline, ""):
        print(line, end="")

    print("[+] API environment updated and services restarted.")
    client.close()

if __name__ == "__main__":
    fix_env()
