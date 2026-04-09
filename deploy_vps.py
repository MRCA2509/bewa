import paramiko
import sys
import time

def deploy():
    hostname = "72.62.120.102"
    username = "root"
    password = "passwordE@25"
    domain = "controltower.digital"

    print(f"[*] Connecting to {hostname}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(hostname, username=username, password=password, timeout=10)
        print("[+] Connected successfully.")
    except Exception as e:
        print(f"[-] Connection failed: {e}")
        return

    # One big setup script
    setup_script = f"""
set -e
export DEBIAN_FRONTEND=noninteractive

echo "[1/8] Updating system and installing base packages..."
apt-get update
apt-get install -y nginx mysql-server python3-venv python3-pip git curl nodejs npm certbot python3-certbot-nginx

echo "[2/8] Configuring MySQL..."
# Ensure MySQL is running
systemctl start mysql
# Create database and user if not exists
mysql -e "CREATE DATABASE IF NOT EXISTS bewa_logistics;"
mysql -e "CREATE USER IF NOT EXISTS 'bewa_user'@'localhost' IDENTIFIED BY 'bewa_pass_2026';"
mysql -e "GRANT ALL PRIVILEGES ON bewa_logistics.* TO 'bewa_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "[3/8] Cloning Repository..."
mkdir -p /var/www
cd /var/www
if [ -d "bewa" ]; then
    rm -rf bewa
fi
git clone https://github.com/MRCA2509/bewa.git
cd bewa

echo "[4/8] Setting up Python Environment..."
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

echo "[5/8] Creating .env file..."
cat <<EOF > .env
BEWA_API_KEY=bewa-internal-2026
JWT_SECRET=bewa-super-secret-key-2026
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=bewa_user
MYSQL_PASSWORD=bewa_pass_2026
MYSQL_DATABASE=bewa_logistics
EOF

echo "[6/8] Building React Frontend..."
cd web/frontend
npm install
npm run build
cd ../..

echo "[7/8] Configuring Gunicorn and Systemd..."
cat <<EOF > /etc/systemd/system/bewa.service
[Unit]
Description=Gunicorn instance to serve BEWA Backend
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/bewa/web
Environment="PATH=/var/www/bewa/venv/bin"
ExecStart=/var/www/bewa/venv/bin/gunicorn --workers 3 --bind unix:bewa.sock -m 007 server:app

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable bewa
systemctl restart bewa

echo "[8/8] Configuring Nginx..."
cat <<EOF > /etc/nginx/sites-available/bewa
server {{
    listen 80;
    server_name {domain};

    location / {{
        include proxy_params;
        proxy_pass http://unix:/var/www/bewa/web/bewa.sock;
    }}

    location /static {{
        alias /var/www/bewa/web/frontend/dist;
    }}
}}
EOF

ln -sf /etc/nginx/sites-available/bewa /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "[*] DEPLOYMENT BASE COMPLETED"
"""

    stdin, stdout, stderr = client.exec_command(setup_script, get_pty=True)
    
    # Print output in real-time
    for line in iter(stdout.readline, ""):
        print(line, end="")
    
    error = stderr.read().decode()
    if error:
        print("\n[!] Errors encountered:")
        print(error)

    # SSL Attempt (Optional, might fail if DNS isn't ready)
    print(f"[*] Attempting SSL installation for {domain}...")
    ssl_cmd = f"certbot --nginx -d {domain} --non-interactive --agree-tos -m mrca2509@gmail.com"
    stdin, stdout, stderr = client.exec_command(ssl_cmd)
    print(stdout.read().decode())
    print(stderr.read().decode())

    client.close()
    print("[+] Deployment script finished.")

if __name__ == "__main__":
    deploy()
