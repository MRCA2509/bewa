import paramiko
import os

def migrate():
    hostname = "72.62.120.102"
    username = "root"
    password = "passwordE@25"
    local_file = "bewa_backup_utf8.sql"
    remote_file = "/tmp/bewa_backup_utf8.sql"

    print(f"[*] Connecting to {hostname}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(hostname, username=username, password=password, timeout=10)
        transport = client.get_transport()
        transport.set_keepalive(30)
        print("[+] Connected with keepalive.")
    except Exception as e:
        print(f"[-] Connection failed: {e}")
        return

    # Upload file
    print(f"[*] Uploading {local_file} to VPS...")
    sftp = client.open_sftp()
    sftp.put(local_file, remote_file)
    sftp.close()
    print("[+] Upload complete.")

    # Import file
    print("[*] Importing data to VPS MySQL as root...")
    # Using system root for import avoids privilege issues with DEFINER or global vars
    import_cmd = f"mysql bewa_logistics < {remote_file}"
    
    stdin, stdout, stderr = client.exec_command(import_cmd)
    
    output = stdout.read().decode(errors='replace')
    error = stderr.read().decode(errors='replace')
    
    if error:
        print(f"[!] Import messages/errors:\n{error}")
    else:
        print("[+] Database import successful.")

    # Clean up
    client.exec_command(f"rm {remote_file}")
    client.close()
    print("[+] Migration finished.")

if __name__ == "__main__":
    migrate()
