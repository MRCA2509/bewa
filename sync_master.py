import subprocess
import paramiko
import os
import sys

def run_cmd(cmd, cwd=None, exit_on_fail=True):
    print(f">> Menjalankan: {cmd}")
    result = subprocess.run(cmd, cwd=cwd, shell=True)
    if result.returncode != 0 and exit_on_fail:
        print(f"[!] Gagal mengeksekusi: {cmd}")
        sys.exit(1)
    return result

def dump_local_db(output_file):
    print("\n[1/5] [DB] Mengekspor Database Lokal (MySQL)...")
    # Menambahkan --set-gtid-purged=OFF dan --column-statistics=0 agar kompatibel dengan VPS
    run_cmd(f"mysqldump -u root --set-gtid-purged=OFF --column-statistics=0 bewa_logistics > {output_file}")
    
def git_sync():
    print("\n[2/5] [GIT] Menyinkronkan Kode ke GitHub...")
    run_cmd("git add .")
    # Abaikan error jika tidak ada yang perlu di-commit
    subprocess.run('git commit -m "Auto-sync master dari lokal"', shell=True)
    run_cmd("git push origin main")

def deploy_to_vps_and_db(sql_file):
    print("\n[3/5] [VPS] Mengunggah Database dan Deploy ke VPS...")
    hostname = "72.62.120.102"
    username = "root"
    password = "passwordE@25"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname, username=username, password=password, timeout=10)
    except Exception as e:
        print(f"[!] Gagal koneksi SSH: {e}")
        sys.exit(1)
        
    def progress_callback(transferred, total):
        percent = (transferred / total) * 100
        sys.stdout.write(f"\r      -> Progress Upload: {percent:.1f}% ({transferred/(1024*1024):.1f} MB / {total/(1024*1024):.1f} MB)")
        sys.stdout.flush()

    sftp = client.open_sftp()
    remote_sql_path = f"/var/www/bewa/{sql_file}"
    print(f"      -> Mentransfer file SQL ({os.path.getsize(sql_file)/(1024*1024):.1f} MB) ke VPS...")
    
    sftp.put(sql_file, remote_sql_path, callback=progress_callback)
    print("\n      -> Upload Selesai!")
    sftp.close()

    script = f"""
    echo "      -> Menarik pembaruan kode (Ganti Paksa) dari GitHub..."
    cd /var/www/bewa
    git fetch --all
    git reset --hard origin/main

    echo "      -> Mengimpor Database VPS (Stripping DEFINER & GTID)..."
    # Menghapus DEFINER agar bisa diimpor oleh bewa_user tanpa error SYSTEM_USER
    sed -e 's/DEFINER=[^*]*\*/\*/g' -e 's/DEFINER=[^ ]*//g' {sql_file} | mysql -u bewa_user -pbewa_pass_2026 bewa_logistics || echo "Peringatan: Ada kendala saat import DB, melanjutkan ke build..."
    rm {sql_file}

    echo "      -> Rebuild Frontend..."
    cd web/frontend
    rm -rf node_modules/.vite
    npm install
    npm run build

    echo "      -> Restarting layanan Backend (Gunicorn & Nginx)..."
    systemctl restart bewa nginx
    """
    
    stdin, stdout, stderr = client.exec_command(script, get_pty=True)
    for line in iter(stdout.readline, ""):
        print("VPS> " + line.strip("\n"))
        
    client.close()

def build_desktop():
    print("\n[4/5] [DESKTOP] Mem-build Desktop App (POD Desktop)...")
    pod_dir = os.path.join(os.getcwd(), "pod-desktop")
    if os.path.exists(pod_dir):
        run_cmd("npm run dist", cwd=pod_dir)
    else:
        print("[!] Folder pod-desktop tidak ditemukan di direktori saat ini.")

if __name__ == "__main__":
    print("="*50)
    print("      MASTER SINKRONISASI BEWA LOGISTICS      ")
    print("="*50)
    
    sql_backup = "bewa_sync_temp.sql"
    
    # 1. Ekspor DB Lokal
    dump_local_db(sql_backup)
    
    # 2. Push Kode ke Git
    git_sync()
    
    # 3. Upload DB ke VPS & Deploy
    deploy_to_vps_and_db(sql_backup)
    
    # Bersihkan file temp SQL lokal
    if os.path.exists(sql_backup):
        os.remove(sql_backup)
    
    # 4. Build Desktop App versi baru
    build_desktop()
    
    print("\n[5/5] SELESAI! Web VPS, Database Live, dan Desktop App telah diselaraskan.")
