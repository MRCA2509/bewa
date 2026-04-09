import paramiko

def force_patch_js():
    hostname = "72.62.120.102"
    username = "root"
    password = "passwordE@25"

    print("[*] Connecting to VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname, username=username, password=password, timeout=10)
    
    script = """
echo "[*] Forcing patch on compiled JS files..."
cd /var/www/bewa/web/frontend/dist/assets

# Find JS files containing localhost:5000 and replace it with empty string
for file in *.js; do
    if grep -q "http://localhost:5000" "$file"; then
        echo "[!] Found localhost in $file. Patching..."
        sed -i 's|http://localhost:5000||g' "$file"
    fi
done

echo "[*] Cleaning Nginx cache and restarting..."
# Sometimes Vite caches the env in node_modules/.vite
rm -rf /var/www/bewa/web/frontend/node_modules/.vite
systemctl restart nginx
"""

    stdin, stdout, stderr = client.exec_command(script, get_pty=True)
    
    for line in iter(stdout.readline, ""):
        print(line, end="")

    print("[+] Patch script finished.")
    client.close()

if __name__ == "__main__":
    force_patch_js()
