"""
Bewa Logistics Web Server - Flask API Backend
Provides REST API for the React frontend
"""

# -*- coding: utf-8 -*-
import os
import sys
import threading
from functools import wraps
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_from_directory, send_file
import pandas as pd
import io
import jwt
import bcrypt
import mysql.connector
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# Fix Windows console encoding
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Add project root to path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from config.database import DB_CONFIG, get_connection, close_connection
from config.logger import setup_logger

logger = setup_logger(__name__)

static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend', 'dist')
app = Flask(__name__, static_folder=static_dir, static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB max upload size
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173", 
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174"
            ]
        }
    },
)

# Global state with thread safety
merge_lock = threading.Lock()
merge_status = {"ongoing": False, "message": "Idle", "progress": 0}

# Internal API Key - Move to env variable
_API_KEY = os.environ.get("BEWA_API_KEY")
if not _API_KEY:
    logger.warning("BEWA_API_KEY not set in environment, using development default")
    _API_KEY = "bewa-internal-2026"

logger.info(
    f"API Backend started with key ending in: ...{_API_KEY[-4:] if _API_KEY else 'NONE'}"
)


def require_api_key(f):
    """Decorator to require API key for destructive operations."""

    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-API-Key", "") or request.args.get("api_key", "")
        if not key or key != _API_KEY:
            logger.warning(f"Unauthorized API access attempt to {request.path}")
            return jsonify(
                {"success": False, "message": "Unauthorized. API Key salah."}
            ), 401
        return f(*args, **kwargs)

    return decorated

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    logger.warning("JWT_SECRET not set in environment, using development default")
    JWT_SECRET = "bewa-super-secret-key-2026"

def require_jwt(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "")
        if token.startswith("Bearer "):
            token = token.split(" ")[1]
        
        if not token:
            return jsonify({"success": False, "message": "Unauthorized. Token missing."}), 401
            
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user = data
        except Exception:
            return jsonify({"success": False, "message": "Unauthorized. Token invalid."}), 401
            
        return f(*args, **kwargs)

    return decorated


# Database config for this app
BEWA_DB_CONFIG = DB_CONFIG.copy()

# --- Auth & Users endpoints ---

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
        
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE username = %s LIMIT 1", (username,))
        user_record = cursor.fetchone()
        
        cursor.close()
        close_connection(conn)
        
        if not user_record:
            return jsonify({"success": False, "message": "Invalid username or password"}), 401
            
        if not bcrypt.checkpw(password.encode('utf-8'), user_record['password_hash'].encode('utf-8')):
            return jsonify({"success": False, "message": "Invalid username or password"}), 401
            
        # Success - generate token
        token_payload = {
            "id": user_record["id"],
            "username": user_record["username"],
            "role": user_record["role"],
            "dp_access": user_record["dp_access"],
            "name": user_record["name"],
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
        
        # Omit password hash from response
        del user_record['password_hash']
        
        return jsonify({
            "success": True,
            "token": token,
            "user": user_record
        })
        
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return jsonify({"success": False, "message": "Internal server error"}), 500

@app.route("/api/users", methods=["GET"])
@require_jwt
def get_users():
    if request.user.get('role') != 'RM':
        return jsonify({"success": False, "message": "Forbidden. RM access only."}), 403
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
        
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, username, role, dp_access, name, created_at FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()
        cursor.close()
        close_connection(conn)
        
        return jsonify({"success": True, "data": users})
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/users", methods=["POST"])
@require_jwt
def create_user():
    if request.user.get('role') != 'RM':
        return jsonify({"success": False, "message": "Forbidden. RM access only."}), 403
        
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "KOORDINATOR").strip()
    dp_access = data.get("dp_access", "").strip()
    name = data.get("name", "").strip()
    
    if not username or not password or not role or not name:
        return jsonify({"success": False, "message": "Required fields missing"}), 400
        
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
        
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, password_hash, role, dp_access, name) VALUES (%s, %s, %s, %s, %s)",
            (username, hashed, role, dp_access, name)
        )
        conn.commit()
        cursor.close()
        close_connection(conn)
        
        return jsonify({"success": True, "message": "User created successfully."})
    except mysql.connector.IntegrityError:
        return jsonify({"success": False, "message": "Username already exists."}), 400
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/users/<int:user_id>", methods=["DELETE"])
@require_jwt
def delete_user(user_id):
    if request.user.get('role') != 'RM':
        return jsonify({"success": False, "message": "Forbidden."}), 403
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
        
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = %s AND role != 'RM'", (user_id,))
        rows = cursor.rowcount
        conn.commit()
        cursor.close()
        close_connection(conn)
        
        if rows > 0:
            return jsonify({"success": True, "message": "User deleted."})
        else:
            return jsonify({"success": False, "message": "User not found or protected."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/actions/run-sync-master", methods=["POST"])
@require_jwt
def run_sync_master():
    if request.user.get('role') != 'RM':
        return jsonify({"success": False, "message": "Forbidden. Akses ditolak."}), 403
        
    if sys.platform != "win32":
        return jsonify({"success": False, "message": "Fitur Sync Global hanya dapat dieksekusi secara aman melalui web di komputer lokal (Laptop/PC), bukan di VPS Cloud."}), 400
        
    try:
        import subprocess
        # Jalankan skrip deploy.bat langsung secara asinkron di command prompt.
        # Ini akan otomatis memunculkan jendela console hitam di laptop agar prosesnya terlihat.
        subprocess.Popen(['cmd.exe', '/c', 'start', 'deploy.bat'], cwd=BASE_DIR)
        return jsonify({"success": True, "message": "Skrip Deploy & Sync telah dijadwalkan! Silakan pantau jendela Terminal hitam baru di layar komputer Anda."})
    except Exception as e:
        logger.error(f"Error triggering sync: {e}")
        return jsonify({"success": False, "message": f"Gagal menjalankan skrip: {str(e)}"}), 500

@app.route("/api/actions/sync-incoming-pod", methods=["POST"])
@require_jwt
def sync_incoming_pod():
    if "file" not in request.files:
        return jsonify({"success": False, "message": "Tidak ada file"}), 400
        
    file = request.files["file"]
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file)
        else:
            df = pd.read_excel(file)
            
        waybill_col = next((c for c in df.columns if "waybill" in str(c).lower()), None)
        sprinter_name_col = next((c for c in df.columns if "sprinter delivery" in str(c).lower() and "kode" not in str(c).lower()), None)
        sprinter_code_col = next((c for c in df.columns if "kode sprinter delivery" in str(c).lower() or "kode sprinter" in str(c).lower()), None)
        
        # J&T often has multiple 'Penerima' columns. Try common variants and choose the one likely to have the name.
        penerima_candidates = [c for c in df.columns if str(c).lower() == "penerima" or str(c).lower() == "nama penerima" or str(c).lower() == "penerima.1"]
        penerima_col = None
        if "Penerima.1" in penerima_candidates: 
            penerima_col = "Penerima.1"
        elif "Penerima" in penerima_candidates:
            penerima_col = "Penerima"
        elif penerima_candidates:
            penerima_col = penerima_candidates[0]
        
        if not waybill_col or not sprinter_name_col or not sprinter_code_col:
             return jsonify({"success": False, "message": "Format file tidak sesuai. Pastikan ada No. Waybill, Sprinter Delivery, dan Kode Sprinter Delivery."}), 400
             
        df["_wb"] = df[waybill_col].astype(str).str.strip().str.upper().str.replace(r'\.0$', '', regex=True)
        df = df[df["_wb"] != "NAN"]
        
        excel_data = df[["_wb", sprinter_name_col, sprinter_code_col] + ([penerima_col] if penerima_col else [])].to_dict('records')
        wb_map = {row["_wb"]: {
            "name": row[sprinter_name_col], 
            "code": row[sprinter_code_col],
            "penerima": row.get(penerima_col) if penerima_col else None
        } for row in excel_data}
        
    except Exception as e:
        return jsonify({"success": False, "message": f"Gagal membaca file: {str(e)}"}), 500
        
    conn = get_db_connection()
    if not conn:
         return jsonify({"success": False, "message": "Database error"}), 500
         
    try:
        cursor = conn.cursor(dictionary=True)
        
        # Remove aging filter. We only care if the waybill exists in either shipments or shipments_histories
        # Collecting all distinct waybills from excel
        all_wb = list(wb_map.keys())
        if not all_wb:
            return jsonify({"success": True, "message": "Excel file empty.", "updated": 0})

        format_strings = ','.join(['%s'] * len(all_wb))
        
        # Check Active
        cursor.execute(f"SELECT waybill_id FROM shipments WHERE waybill_id IN ({format_strings})", tuple(all_wb))
        found_active = {r['waybill_id'] for r in cursor.fetchall()}
        
        # Check History
        cursor.execute(f"SELECT waybill_id FROM shipments_histories WHERE waybill_id IN ({format_strings})", tuple(all_wb))
        found_history = {r['waybill_id'] for r in cursor.fetchall()}
        
        found_any = found_active | found_history
        
        to_insert = []
        update_penerima_active = []
        update_penerima_history = []

        for wb, info in wb_map.items():
            if wb in found_any:
                name = str(info["name"]) if pd.notna(info["name"]) else ""
                code = str(info["code"]) if pd.notna(info["code"]) else ""
                to_insert.append((wb, name, code))
                
                penerima_val = info.get("penerima")
                if pd.notna(penerima_val) and str(penerima_val).strip():
                    p_val = str(penerima_val).strip()
                    if wb in found_active:
                        update_penerima_active.append((p_val, wb))
                    if wb in found_history:
                        update_penerima_history.append((p_val, wb))
                
        if to_insert:
            cursor.executemany("""
                INSERT INTO sprinter_assignments (waybill_id, sprinter_name, sprinter_code, assigned_at) 
                VALUES (%s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE sprinter_name=VALUES(sprinter_name), sprinter_code=VALUES(sprinter_code), assigned_at=NOW()
            """, to_insert)
            
        if update_penerima_active:
            cursor.executemany("UPDATE shipments SET penerima = %s WHERE waybill_id = %s", update_penerima_active)
        if update_penerima_history:
            cursor.executemany("UPDATE shipments_histories SET penerima = %s WHERE waybill_id = %s", update_penerima_history)
            
        conn.commit()
            
        cursor.close()
        close_connection(conn)
        return jsonify({"success": True, "message": f"Berhasil melink {len(to_insert)} paket ke Sprinter aktif."})
        
    except Exception as e:
         return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/sync/dp-assignments", methods=["GET"])
@require_api_key
def sync_dp_assignments():
    dp = request.args.get("drop_point", "")
    if not dp:
        return jsonify({"success": False, "message": "drop_point is required"}), 400
        
    conn = get_db_connection()
    if not conn:
         return jsonify({"success": False, "message": "Database error"}), 500
         
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT s.waybill_id, s.penerima, s.tujuan, s.drop_point, s.waktu_sampai,
                   sa.sprinter_name, sa.sprinter_code, s.station_scan, s.jenis_scan, s.waktu_scan
            FROM shipments s
            JOIN sprinter_assignments sa ON s.waybill_id = sa.waybill_id
            WHERE s.drop_point = %s
              AND s.waktu_sampai >= '2010-01-01 00:00:00'
              AND DATE(s.waktu_sampai) <= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
              AND (s.waktu_regis_retur IS NULL OR s.waktu_regis_retur <= '2010-01-01 00:00:00')
              AND (s.jenis_scan IS NULL OR s.jenis_scan != 'Scan Kirim')
        """, (dp,))
        assignments = cursor.fetchall()
        
        cursor.close()
        close_connection(conn)
        return jsonify({"success": True, "data": assignments})
    except Exception as e:
         import traceback
         error_trace = traceback.format_exc()
         logger.error(f"Sync DP Assignments Error: {error_trace}")
         if conn: close_connection(conn)
         return jsonify({
             "success": False, 
             "message": str(e), 
             "detail": error_trace
         }), 500

@app.route("/api/sync/list-drop-points", methods=["GET"])
@require_jwt
def list_drop_points():
    # Only RM or ADMIN or users with * access should call this
    user = request.user
    if user.get('role') not in ['RM', 'ADMIN'] and user.get('dp_access') != '*':
        return jsonify({"success": False, "message": "Access denied"}), 403

    conn = get_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
        
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT DISTINCT drop_point FROM shipments WHERE drop_point IS NOT NULL AND drop_point != '' ORDER BY drop_point")
        dps = [row['drop_point'] for row in cursor.fetchall()]
        cursor.close()
        close_connection(conn)
        return jsonify({"success": True, "data": dps})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/actions/sync-pod-status", methods=["POST"])
@require_api_key
def sync_pod_status():
    data = request.json
    if not data or not isinstance(data.get('completed_waybills'), list):
        return jsonify({"success": False, "message": "completed_waybills array is required"}), 400
        
    completed_waybills = data.get('completed_waybills', [])
    rejected_waybills = data.get('rejected_waybills', [])
    
    if not completed_waybills and not rejected_waybills:
        return jsonify({"success": True, "message": "No data to update", "updated": 0})
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
        
    try:
        cursor = conn.cursor()
        updated_count = 0

        # Handle Completed
        if completed_waybills:
            format_strings = ','.join(['%s'] * len(completed_waybills))
            cursor.execute(f"""
                UPDATE sprinter_assignments 
                SET pod_status = 'COMPLETED', pod_completed_at = NOW() 
                WHERE waybill_id IN ({format_strings}) AND pod_status != 'COMPLETED'
            """, tuple(completed_waybills))
            updated_count += cursor.rowcount

        # Handle Rejected (Status Reversal)
        if rejected_waybills:
            format_strings = ','.join(['%s'] * len(rejected_waybills))
            cursor.execute(f"""
                UPDATE sprinter_assignments 
                SET pod_status = 'PENDING', pod_completed_at = NULL 
                WHERE waybill_id IN ({format_strings})
            """, tuple(rejected_waybills))
            updated_count += cursor.rowcount
            
        conn.commit()
        cursor.close()
        close_connection(conn)
        return jsonify({"success": True, "message": "Sync complete", "updated": updated_count})
    except Exception as e:
        if conn: close_connection(conn)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/api/reports/sprinter-pod", methods=["GET"])
@require_jwt
def get_sprinter_pod_report():
    user = request.user
    role = user.get('role', '')
    dp_access = user.get('dp_access', '')

    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database error"}), 500
        
    try:
        cursor = conn.cursor(dictionary=True)
        query = """
            SELECT sa.sprinter_name, sa.sprinter_code, s.drop_point,
                   COUNT(sa.waybill_id) as total_tasks,
                   SUM(CASE WHEN sa.pod_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
                   MAX(sa.pod_completed_at) as last_completed_at
            FROM sprinter_assignments sa
            JOIN (
                SELECT waybill_id, drop_point 
                FROM shipments 
                WHERE waktu_sampai >= '2010-01-01 00:00:00'
                  AND DATE(waktu_sampai) <= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
                  AND (waktu_regis_retur IS NULL OR waktu_regis_retur <= '2010-01-01 00:00:00')
                  AND (jenis_scan IS NULL OR jenis_scan != 'Scan Kirim')
            ) s ON sa.waybill_id = s.waybill_id
            WHERE 1=1
        """
        
        params = []
        if role != 'RM' and role != 'ADMIN' and '*' not in dp_access:
            dp_list = [dp.strip() for dp in dp_access.split(',') if dp.strip()]
            if dp_list:
                format_strings = ','.join(['%s'] * len(dp_list))
                query += f" AND s.drop_point IN ({format_strings})"
                params.extend(dp_list)
            else:
                return jsonify({"success": True, "data": []}) # No access
                
        query += " GROUP BY sa.sprinter_name, sa.sprinter_code, s.drop_point ORDER BY s.drop_point ASC, total_tasks DESC"
        
        cursor.execute(query, tuple(params))
        report = cursor.fetchall()
        cursor.close()
        close_connection(conn)
        return jsonify({"success": True, "data": report})
    except Exception as e:
        logger.error(f"Error fetching sprinter report: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

def get_db_connection():
    """Get MySQL connection from the pool"""
    try:
        return get_connection()
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None


@app.route("/")
def serve_frontend():
    """Serve React frontend"""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/health")
def health_check():
    """Health check endpoint"""
    return jsonify(
        {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "service": "Bewa Logistics Web Server",
        }
    )


@app.route("/api/stats")
def get_stats():
    """Get database statistics"""
    conn = get_db_connection()
    if not conn:
        logger.error("Database connection failed for /api/stats")
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # Get counts
        cursor.execute("SELECT COUNT(*) as count FROM shipments")
        active_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM shipments_histories")
        history_count = cursor.fetchone()["count"]

        # Get detailed stats
        cursor.execute("""
            SELECT
                COUNT(*) as total_records,
                COUNT(DISTINCT tujuan) as unique_destinations,
                COUNT(DISTINCT jenis_scan) as unique_scan_types,
                COUNT(DISTINCT station_scan) as unique_stations
            FROM shipments_histories
        """)
        detailed = cursor.fetchone()

        # Get recent activity
        cursor.execute("""
            SELECT waybill_id, tujuan, jenis_scan, station_scan, archived_at
            FROM shipments_histories
            ORDER BY archived_at DESC
            LIMIT 10
        """)
        recent = cursor.fetchall()

        cursor.close()
        close_connection(conn)

        logger.debug(f"Stats retrieved: active={active_count}, history={history_count}")
        return jsonify(
            {
                "success": True,
                "stats": {
                    "active_shipments": active_count,
                    "history_shipments": history_count,
                    "total_records": active_count + history_count,
                    "unique_destinations": detailed["unique_destinations"],
                    "unique_scan_types": detailed["unique_scan_types"],
                    "unique_stations": detailed["unique_stations"],
                    "recent_activity": recent,
                },
            }
        )

    except Exception as e:
        logger.error(f"Error getting stats: {e}", exc_info=True)
        return jsonify(
            {"success": False, "message": "Internal server error while fetching stats"}
        ), 500


@app.route("/api/report/database")
def get_database_report():
    """Get full database records for reporting"""
    conn = get_db_connection()
    if not conn:
        logger.error("Database connection failed for /api/report/database")
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        page = request.args.get("page", 1, type=int)
        limit = request.args.get("limit", 100, type=int)
        offset = (page - 1) * limit

        cursor = conn.cursor(dictionary=True)

        # Get total active count
        cursor.execute("SELECT COUNT(*) as count FROM shipments")
        total_active = cursor.fetchone()["count"]

        # Get active shipments (main table) with limit and offset
        cursor.execute(
            """
            SELECT waybill_id, tujuan, jenis_layanan, dp_outgoing,
                   sumber_order, berat_ditagih, drop_point, waktu_sampai,
                   lokasi_sebelumnya, discan_oleh, station_scan, jenis_scan,
                   created_at, updated_at, biaya_cod, total_dfod, 
                   waktu_regis_retur, waktu_konfirmasi_retur, waktu_scan,
                   alasan_masalah, lokasi_berikutnya
            FROM shipments
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """,
            (limit, offset),
        )
        active = cursor.fetchall()

        # Remove massive 10,000 history query because UI no longer uses it.
        # This instantly saves 5-10 seconds per page load!
        history = []

        cursor.close()
        close_connection(conn)

        logger.debug(
            f"Database report retrieved: page {page}, {len(active)} active packages"
        )
        return jsonify(
            {
                "success": True,
                "data": {
                    "active": active,
                    "history": history,
                    "pagination": {
                        "page": page,
                        "limit": limit,
                        "total": total_active,
                        "total_pages": (total_active + limit - 1) // limit
                        if limit > 0
                        else 0,
                    },
                },
            }
        )

    except Exception as e:
        logger.error(f"Error getting database report: {e}", exc_info=True)
        return jsonify(
            {
                "success": False,
                "message": "Internal server error while fetching database report",
            }
        ), 500


@app.route("/api/report/summary")
def get_summary_report():
    """Get summary report with aggregations"""
    conn = get_db_connection()
    if not conn:
        logger.error("Database connection failed for /api/report/summary")
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        
        # Get monitored drop points from environment or default to the original 8
        monitored_dps_raw = os.environ.get("MONITORED_DROP_POINTS", "MABA,BULI,WASILE,SOFIFI,LABUHA,FALAJAWA2,SANANA,BOBONG")
        monitored_dps = [dp.strip() for dp in monitored_dps_raw.split(",") if dp.strip()]
        
        if not monitored_dps:
            # Fallback: get all active drop points if nothing configured
            cursor.execute("SELECT DISTINCT drop_point FROM shipments WHERE drop_point IS NOT NULL AND drop_point != ''")
            monitored_dps = [r['drop_point'] for r in cursor.fetchall()]

        dp_placeholder = ','.join(['%s'] * len(monitored_dps))

        # Unified Drop Point Comparison query
        from datetime import datetime
        from dateutil.relativedelta import relativedelta

        cursor.execute(
            "SELECT MAX(DATE_FORMAT(waktu_sampai, '%Y-%m')) as max_m FROM shipments WHERE waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'"
        )
        res_max = cursor.fetchone()

        current_month = datetime.now().strftime("%Y-%m")
        if res_max and res_max["max_m"]:
            current_month = res_max["max_m"]

        dt = datetime.strptime(current_month, "%Y-%m")
        last_month = (dt - relativedelta(months=1)).strftime("%Y-%m")

        # Calculate boundaries to use indexes on database level
        start_last_month = (dt - relativedelta(months=1)).strftime("%Y-%m-01 00:00:00")
        end_current_month = (dt + relativedelta(months=1)).strftime("%Y-%m-01 00:00:00")

        cursor.execute(
            f"""
            SELECT 
                drop_point,
                COALESCE(CAST(ROUND(SUM(CASE WHEN DATE_FORMAT(date, '%Y-%m') = %s THEN total_cnt ELSE 0 END) / 
                           NULLIF(COUNT(DISTINCT CASE WHEN DATE_FORMAT(date, '%Y-%m') = %s THEN date END), 0), 0) AS SIGNED), 0) as avg_current,
                COALESCE(CAST(ROUND(SUM(CASE WHEN DATE_FORMAT(date, '%Y-%m') = %s THEN total_cnt ELSE 0 END) / 
                           NULLIF(COUNT(DISTINCT CASE WHEN DATE_FORMAT(date, '%Y-%m') = %s THEN date END), 0), 0) AS SIGNED), 0) as avg_last,
                COALESCE(CAST(SUM(CASE WHEN is_active = 1 THEN active_cnt ELSE 0 END) AS SIGNED), 0) as active_current
            FROM (
                SELECT drop_point, DATE(waktu_sampai) as date, 1 as is_active, COUNT(*) as active_cnt, COUNT(*) as total_cnt
                FROM shipments
                WHERE waktu_sampai >= %s AND waktu_sampai < %s
                GROUP BY drop_point, DATE(waktu_sampai)
                
                UNION ALL
                
                SELECT drop_point, DATE(waktu_sampai) as date, 0 as is_active, 0 as active_cnt, COUNT(*) as total_cnt
                FROM shipments_histories
                WHERE waktu_sampai >= %s AND waktu_sampai < %s
                GROUP BY drop_point, DATE(waktu_sampai)
            ) AS daily
            WHERE drop_point IN ({dp_placeholder})
            GROUP BY drop_point
            ORDER BY avg_current DESC, avg_last DESC
        """,
            (
                current_month,
                current_month,
                last_month,
                last_month,
                start_last_month,
                end_current_month,
                start_last_month,
                end_current_month,
                *monitored_dps,
            ),
        )
        dp_comparisons = cursor.fetchall()

        # Mirror exactly the Daily Progress logic for the active target and today's completion
        cursor.execute(f"""
            SELECT 
                drop_point,
                COUNT(*) as base_active_count,
                SUM(CASE WHEN waktu_regis_retur >= CURDATE() THEN 1 ELSE 0 END) as regis_retur_hari_ini
            FROM shipments
            WHERE drop_point IN ({dp_placeholder})
              AND waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'
              AND DATE(waktu_sampai) <= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
              AND (waktu_regis_retur IS NULL OR waktu_regis_retur = '0001-01-01' OR waktu_regis_retur < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_regis_retur >= CURDATE())
              AND (jenis_scan IS NULL OR jenis_scan != 'Scan Kirim' OR waktu_scan IS NULL OR waktu_scan = '0001-01-01' OR waktu_scan < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_scan >= CURDATE())
            GROUP BY drop_point
        """, tuple(monitored_dps))
        active_rows = cursor.fetchall()

        cursor.execute(f"""
            SELECT
                drop_point,
                COUNT(*) as history_base_count,
                SUM(CASE WHEN (jenis_scan = 'Scan TTD' OR jenis_scan = 'Scan TTD Retur') AND archived_at >= CURDATE() THEN 1 ELSE 0 END) as ttd_hari_ini
            FROM shipments_histories
            WHERE drop_point IN ({dp_placeholder})
              AND waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'
              AND DATE(waktu_sampai) <= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
              AND archived_at >= CURDATE()
            GROUP BY drop_point
        """, tuple(monitored_dps))
        history_rows = cursor.fetchall()

        combined = {}
        for dp in monitored_dps:
            combined[dp] = {"total_target": 0, "handled": 0}

        for r in active_rows:
            dp = r["drop_point"]
            if dp in combined:
                combined[dp]["total_target"] += int(r["base_active_count"] or 0)
                combined[dp]["handled"] += int(r["regis_retur_hari_ini"] or 0)

        for r in history_rows:
            dp = r["drop_point"]
            if dp in combined:
                combined[dp]["total_target"] += int(r["history_base_count"] or 0)
                combined[dp]["handled"] += int(r["ttd_hari_ini"] or 0)

        dp_ranking = []
        for dp, data in combined.items():
            unhandled = max(0, data["total_target"] - data["handled"])
            dp_ranking.append(
                {
                    "drop_point": dp,
                    "unhandled_packages": unhandled,
                    "handled_packages": data["handled"],
                    "total_aging": data["total_target"],
                }
            )

        dp_ranking.sort(key=lambda x: x["unhandled_packages"])

        cursor.close()
        close_connection(conn)

        logger.debug(
            f"Summary report retrieved: {len(dp_comparisons)} comparisons, {len(dp_ranking)} DP rankings"
        )
        return jsonify(
            {
                "success": True,
                "summary": {
                    "dp_comparisons": dp_comparisons,
                    "current_month": current_month,
                    "last_month": last_month,
                    "dp_ranking": dp_ranking,
                },
            }
        )

    except Exception as e:
        logger.error(f"Error getting summary report: {e}", exc_info=True)
        return jsonify(
            {
                "success": False,
                "message": "Internal server error while fetching summary report",
            }
        ), 500


@app.route("/api/report/aging-details")
def get_aging_details():
    """Get detailed records and stats for packages aging >= 3 days"""
    conn = get_db_connection()
    if not conn:
        logger.error("Database connection failed for /api/report/aging-details")
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        page = request.args.get("page", 1, type=int)
        limit = request.args.get("limit", 100, type=int)
        offset = (page - 1) * limit

        cursor = conn.cursor(dictionary=True)

        # Get total count first for pagination
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM shipments
            WHERE waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'
              AND DATE(waktu_sampai) <= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
              AND (waktu_regis_retur IS NULL OR waktu_regis_retur = '0001-01-01' OR waktu_regis_retur < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_regis_retur >= CURDATE())
              AND (jenis_scan IS NULL OR jenis_scan != 'Scan Kirim' OR waktu_scan IS NULL OR waktu_scan = '0001-01-01' OR waktu_scan < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_scan >= CURDATE())
        """)
        total_aging = cursor.fetchone()["count"]

        # Main query for aging shipments (>= 3 days) with pagination
        cursor.execute(
            """
            SELECT *, 
                   DATEDIFF(NOW(), waktu_sampai) as aging_days
            FROM shipments
            WHERE waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'
              AND DATE(waktu_sampai) <= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
              AND (waktu_regis_retur IS NULL OR waktu_regis_retur = '0001-01-01' OR waktu_regis_retur < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_regis_retur >= CURDATE())
              AND (jenis_scan IS NULL OR jenis_scan != 'Scan Kirim' OR waktu_scan IS NULL OR waktu_scan = '0001-01-01' OR waktu_scan < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_scan >= CURDATE())
            ORDER BY waktu_sampai ASC
            LIMIT %s OFFSET %s
        """,
            (limit, offset),
        )
        details = cursor.fetchall()

        # Group summary for ALL aging shipments (still needed for the summary section but could be optimized)
        # For simplicity and to match previous logic, we keep the total stats calculation for now
        cursor.execute("""
            SELECT drop_point, waktu_sampai, waktu_regis_retur
            FROM shipments
            WHERE waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'
              AND DATE(waktu_sampai) <= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
              AND (waktu_regis_retur IS NULL OR waktu_regis_retur = '0001-01-01' OR waktu_regis_retur < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_regis_retur >= CURDATE())
              AND (jenis_scan IS NULL OR jenis_scan != 'Scan Kirim' OR waktu_scan IS NULL OR waktu_scan = '0001-01-01' OR waktu_scan < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_scan >= CURDATE())
        """)
        all_aging = cursor.fetchall()

        def is_handled_successful(sampai_date, regis_date):
            if not sampai_date or str(sampai_date) == "0001-01-01":
                return False
            from datetime import datetime

            now = datetime.now()
            if regis_date and str(regis_date) != "0001-01-01":
                if hasattr(regis_date, "year") and regis_date.year >= 2010:
                    diff = (now - regis_date).days
                    return diff <= 2
            return False

        already_retur = sum(
            1
            for row in all_aging
            if is_handled_successful(row["waktu_sampai"], row["waktu_regis_retur"])
        )
        belum_retur = total_aging - already_retur

        # Group summary by drop_point
        dp_summary = {}
        for row in all_aging:
            dp = row["drop_point"] or "Unknown"
            if dp not in dp_summary:
                dp_summary[dp] = {"total": 0, "retur": 0, "belum": 0}
            dp_summary[dp]["total"] += 1
            if is_handled_successful(row["waktu_sampai"], row["waktu_regis_retur"]):
                dp_summary[dp]["retur"] += 1
            else:
                dp_summary[dp]["belum"] += 1

        cursor.close()
        close_connection(conn)

        logger.info(
            f"Aging report page {page} generated: {len(details)} details, {total_aging} total"
        )
        return jsonify(
            {
                "success": True,
                "data": {
                    "details": details,
                    "summary": {
                        "total": total_aging,
                        "already_retur": already_retur,
                        "belum_retur": belum_retur,
                        "dp_summary": dp_summary,
                    },
                    "pagination": {
                        "page": page,
                        "limit": limit,
                        "total": total_aging,
                        "total_pages": (total_aging + limit - 1) // limit
                        if limit > 0
                        else 0,
                    },
                },
            }
        )

    except Exception as e:
        logger.error(f"Error getting aging details: {e}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/tracking/lookup")
def tracking_lookup():
    """Lookup waybill tracking information"""
    waybill = request.args.get("waybill")
    if not waybill:
        logger.warning("Tracking lookup requested without waybill parameter")
        return jsonify({"success": False, "message": "Waybill required"}), 400

    conn = get_db_connection()
    if not conn:
        logger.error("Database connection failed for tracking lookup")
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # Search in history
        cursor.execute(
            """
            SELECT * FROM shipments_histories
            WHERE waybill_id = %s
            LIMIT 1
        """,
            (waybill,),
        )
        result = cursor.fetchone()

        if not result:
            # Search in active
            cursor.execute(
                """
                SELECT * FROM shipments
                WHERE waybill_id = %s
                LIMIT 1
            """,
                (waybill,),
            )
            result = cursor.fetchone()

        cursor.close()
        close_connection(conn)

        if result:
            logger.debug(f"Tracking lookup successful for: {waybill}")
            return jsonify(
                {
                    "success": True,
                    "data": result,
                    "location": "history" if "archived_at" in result else "active",
                }
            )
        else:
            logger.warning(f"Waybill not found: {waybill}")
            return jsonify(
                {"success": False, "message": f"Waybill {waybill} not found"}
            ), 404

    except Exception as e:
        logger.error(f"Error during tracking lookup: {e}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/report/monitoring-months")
def get_monitoring_months():
    """Get list of available months for monitoring report"""
    try:
        from datetime import datetime
        from dateutil.relativedelta import relativedelta

        now = datetime.now()
        months = [(now - relativedelta(months=i)).strftime("%Y-%m") for i in range(12)]

        return jsonify({"success": True, "months": months})

    except Exception as e:
        logger.error(f"Error filtering shipments: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/report/daily-progress")
def get_daily_progress():
    """Get daily operational progress per Drop Point and Month"""
    conn = get_db_connection()
    if not conn:
        logger.error("Database connection failed for /api/report/daily-progress")
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # 1. Total Target and Regis Retur Hari Ini from Active Shipments
        # Excluding packages resolved (regis_retur or Scan Kirim) before today
        cursor.execute("""
            SELECT 
                drop_point,
                DATE_FORMAT(waktu_sampai, '%Y-%m') as bulan,
                COUNT(*) as base_active_count,
                SUM(CASE WHEN waktu_regis_retur >= CURDATE() THEN 1 ELSE 0 END) as regis_retur_hari_ini
            FROM shipments
            WHERE drop_point IN ('MABA', 'BULI', 'WASILE', 'SOFIFI', 'LABUHA', 'FALAJAWA2', 'SANANA', 'BOBONG')
              AND waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'
              AND (waktu_regis_retur IS NULL OR waktu_regis_retur = '0001-01-01' OR waktu_regis_retur < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_regis_retur >= CURDATE())
              AND (jenis_scan IS NULL OR jenis_scan != 'Scan Kirim' OR waktu_scan IS NULL OR waktu_scan = '0001-01-01' OR waktu_scan < DATE_SUB(CURDATE(), INTERVAL 2 DAY) OR waktu_scan >= CURDATE())
            GROUP BY drop_point, DATE_FORMAT(waktu_sampai, '%Y-%m')
        """)
        active_rows = cursor.fetchall()

        # 2. Add in items completely processed (Scan TTD / Scan TTD Retur) TODAY
        # These count towards the denominator and also are 'TTD Hari Ini'
        cursor.execute("""
            SELECT
                drop_point,
                DATE_FORMAT(waktu_sampai, '%Y-%m') as bulan,
                COUNT(*) as history_base_count,
                SUM(CASE WHEN (jenis_scan = 'Scan TTD' OR jenis_scan = 'Scan TTD Retur') AND archived_at >= CURDATE() THEN 1 ELSE 0 END) as ttd_hari_ini
            FROM shipments_histories
            WHERE drop_point IN ('MABA', 'BULI', 'WASILE', 'SOFIFI', 'LABUHA', 'FALAJAWA2', 'SANANA', 'BOBONG')
              AND waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'
              AND archived_at >= CURDATE()
            GROUP BY drop_point, DATE_FORMAT(waktu_sampai, '%Y-%m')
        """)
        history_rows = cursor.fetchall()

        cursor.close()
        close_connection(conn)

        # 3. Combine Data
        combined = {}
        for r in active_rows:
            # Skip invalid months
            if not r["bulan"]:
                continue
            key = f"{r['bulan']}_{r['drop_point']}"
            combined[key] = {
                "bulan": r["bulan"],
                "drop_point": r["drop_point"],
                "total_target": r["base_active_count"],
                "regis_retur_hari_ini": int(r["regis_retur_hari_ini"] or 0),
                "ttd_hari_ini": 0,
            }

        for r in history_rows:
            if not r["bulan"]:
                continue
            key = f"{r['bulan']}_{r['drop_point']}"
            if key not in combined:
                combined[key] = {
                    "bulan": r["bulan"],
                    "drop_point": r["drop_point"],
                    "total_target": 0,
                    "regis_retur_hari_ini": 0,
                    "ttd_hari_ini": 0,
                }
            combined[key]["total_target"] += r["history_base_count"]
            combined[key]["ttd_hari_ini"] += int(r["ttd_hari_ini"] or 0)

        results = list(combined.values())
        for row in results:
            handled = row["regis_retur_hari_ini"] + row["ttd_hari_ini"]
            row["progress_percent"] = round(
                (handled / row["total_target"] * 100) if row["total_target"] > 0 else 0,
                1,
            )

        # Optional sorting in python since we merged dictionaries
        # Sort by bulan DESC, then progress_percent DESC
        results.sort(key=lambda x: (x["bulan"], x["progress_percent"]), reverse=True)

        return jsonify({"success": True, "data": results})

    except Exception as e:
        logger.error(f"Error fetching daily progress: {e}", exc_info=True)
        if conn:
            close_connection(conn)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/shipments/active/batch-download", methods=["GET"])
def get_active_batch_download():
    """
    Returns ALL waybill_ids currently active in the database.
    Used by the frontend to slice and create Excel batches for JMS Status Terupdate.
    """
    conn = get_connection()
    if not conn:
        return jsonify({"success": False, "error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()

        # We only need the No. Waybill column
        cursor.execute("SELECT waybill_id FROM shipments")
        rows = cursor.fetchall()

        waybills = [row[0] for row in rows if row[0]]

        cursor.close()
        close_connection(conn)

        logger.info(f"Retrieved {len(waybills)} waybills for JMS Batch Download")
        return jsonify({"success": True, "data": waybills, "total": len(waybills)})

    except Exception as e:
        logger.error(f"Error retrieving waybills for batch: {e}", exc_info=True)
        if conn:
            close_connection(conn)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/actions/merge", methods=["POST"])
@require_api_key
def trigger_merge():
    """Trigger merge process"""
    global merge_status

    with merge_lock:
        if merge_status["ongoing"]:
            logger.warning("Merge request rejected - merge already in progress")
            return jsonify(
                {"success": False, "message": "Merge already in progress"}
            ), 400
        merge_status["ongoing"] = True

    def run_merge():
        global merge_status
        logger.info("Starting merge process...")
        merge_status["message"] = "Starting merge process..."
        merge_status["progress"] = 0

        try:
            from services.merge_service import MergeService

            # Use uploads folder for uploaded files
            service = MergeService(
                BASE_DIR, uploads_folder=os.path.join(BASE_DIR, "uploads")
            )
            merge_status["progress"] = 25
            merge_status["message"] = "Loading Excel files from uploads folder..."

            service.load_monitor_sampai()
            merge_status["progress"] = 50
            merge_status["message"] = "Merging data..."

            service.merge_by_waybill()
            merge_status["progress"] = 75
            merge_status["message"] = "Saving to database (smart merge)..."

            # Smart merge: only update if incoming data has newer timestamp
            result = service.save_to_database(clear_before=False, use_smart_merge=True)
            merge_status["progress"] = 100
            merge_status["message"] = (
                f"Completed: {result['history_inserted']} records saved"
            )
            logger.info(f"Merge completed: {result['history_inserted']} records saved")

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            merge_status["message"] = error_msg
            merge_status["ongoing"] = False
            merge_status["progress"] = 0
            logger.error(f"Merge process failed: {e}", exc_info=True)
            return

        merge_status["ongoing"] = False

    # Run in background thread
    thread = threading.Thread(target=run_merge)
    thread.daemon = True
    thread.start()

    logger.info("Merge process started in background thread")
    return jsonify({"success": True, "message": "Merge process started"})


@app.route("/api/actions/update-status", methods=["POST"])
@require_api_key
def update_status():
    """
    Trigger standalone Status Terupdate update process.
    Matches uploaded 'Status Terupdate' against Active Shipments.
    Runs in a background thread and updates merge_status.
    """
    global merge_status
    with merge_lock:
        if merge_status["ongoing"]:
            return jsonify(
                {"success": False, "message": "Update or Merge already in progress"}
            ), 400
        merge_status["ongoing"] = True

    def run_update(status_file):
        global merge_status
        logger.info(f"Starting standalone status update with file: {status_file}")

        merge_status["message"] = "Starting standalone status update..."
        merge_status["progress"] = 10

        try:
            from services.update_status_service import UpdateStatusService

            service = UpdateStatusService(file_path=status_file)

            # Monkeypatch the service process to report progress if possible,
            # but we can just set it to 50 for now
            merge_status["progress"] = 50
            merge_status["message"] = "Processing and mapping records into database..."

            result = service.process()

            if not result["success"]:
                raise Exception(result.get("error", "Unknown error during process"))

            merge_status["progress"] = 100
            merge_status["message"] = (
                f"Update Selesai: {result['stats']['updated_active']} updated, {result['stats']['moved_to_history']} archived"
            )
            logger.info("Standalone update completed successfully.")

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            merge_status["message"] = error_msg
            merge_status["ongoing"] = False
            merge_status["progress"] = 0
            logger.error(f"Error during update status process: {e}", exc_info=True)
            return

        merge_status["ongoing"] = False

    try:
        # Check if Status Terupdate file exists in uploads
        uploads_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"
        )
        status_file = None

        if os.path.exists(uploads_dir):
            for file in os.listdir(uploads_dir):
                if (
                    "status" in file.lower()
                    and file.endswith(".xlsx")
                    and not file.startswith("~$")
                ):
                    filepath = os.path.join(uploads_dir, file)
                    if not status_file or os.path.getmtime(filepath) > os.path.getmtime(
                        status_file
                    ):
                        status_file = filepath

        if not status_file:
            return jsonify(
                {
                    "success": False,
                    "message": "File Status Terupdate tidak ditemukan di folder uploads. Silakan unggah terlebih dahulu.",
                }
            ), 400

        import threading

        thread = threading.Thread(target=run_update, args=(status_file,))
        thread.daemon = True
        thread.start()

        return jsonify(
            {"success": True, "message": "Update Status berjalan di latar belakang"}
        )

    except Exception as e:
        logger.error(f"Error during update status initialization: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/actions/status")
def get_merge_status():
    """Get merge process status"""
    return jsonify({"success": True, "status": merge_status})


@app.route("/api/actions/reset-db", methods=["POST"])
@require_api_key
def reset_database():
    """Reset database (truncate tables) - requires API key"""
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        logger.warning("ALER: User triggered Database Reset from Web UI")

        # Clear tables
        cursor.execute("TRUNCATE TABLE shipments")
        cursor.execute("TRUNCATE TABLE shipments_histories")

        conn.commit()
        cursor.close()
        close_connection(conn)

        logger.info("Database reset successful via Web API")
        return jsonify({"success": True, "message": "Database cleared successfully"})
    except Exception as e:
        logger.error(f"Error resetting database: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/upload", methods=["POST"])
def upload_file():
    """Handle file upload with column validation for Monitor Sampai"""
    if "file" not in request.files:
        logger.warning("Upload request without file")
        return jsonify({"success": False, "message": "No file uploaded"}), 400

    file = request.files["file"]
    upload_type = request.form.get("type", "monitor")

    if file.filename == "":
        logger.warning("Upload request with empty filename")
        return jsonify({"success": False, "message": "No file selected"}), 400

    # Save uploaded file
    upload_dir = os.path.join(BASE_DIR, "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{upload_type}_{timestamp}_{file.filename}"
    filepath = os.path.join(upload_dir, filename)

    file.save(filepath)

    # VALIDATION: Check Monitor Sampai file has required columns
    if upload_type == "monitor":
        import pandas as pd

        try:
            df = pd.read_excel(filepath)

            # Strip columns first to prevent false rejections due to trailing whitespace
            df.columns = [str(col).strip() for col in df.columns]

            # Required columns for Monitor Sampai
            required_cols = ["Drop Point", "Waktu Sampai"]
            missing_cols = [col for col in required_cols if col not in df.columns]

            if missing_cols:
                # Delete invalid file
                os.remove(filepath)
                error_msg = f"Invalid Monitor Sampai file. Missing required columns: {', '.join(missing_cols)}"
                logger.error(f"Upload rejected: {error_msg}")
                return jsonify({"success": False, "message": error_msg}), 400

            logger.info(
                f"Monitor Sampai validation passed. Columns found: {list(df.columns)}"
            )

        except Exception as e:
            # Delete invalid file
            os.remove(filepath)
            error_msg = f"Error reading Excel file: {str(e)}"
            logger.error(f"Upload validation error: {error_msg}")
            return jsonify({"success": False, "message": error_msg}), 400

    # VALIDATION: Check Pencarian Retur file has required columns
    if upload_type == "retur":
        import pandas as pd

        try:
            df = pd.read_excel(filepath)
            df.columns = [str(col).strip() for col in df.columns]

            # Flexible column matching
            def find_col(target, cols):
                def norm(s):
                    return str(s).lower().replace(".", "").replace(" ", "").replace("_", "")

                t_norm = norm(target)
                for c in cols:
                    if norm(c) == t_norm:
                        return c
                return None

            waybill_col = find_col("No. Waybill", df.columns)
            waktu_reg_col = find_col("Waktu Register", df.columns)

            missing_cols = []
            if not waybill_col:
                missing_cols.append("No. Waybill")
            if not waktu_reg_col:
                missing_cols.append("Waktu Register")

            if missing_cols:
                error_msg = f"Invalid Pencarian Retur file. Missing required columns: {', '.join(missing_cols)}. Found columns: {list(df.columns)}"
                os.remove(filepath)
                logger.error(f"Upload rejected: {error_msg}")
                return jsonify({"success": False, "message": error_msg}), 400

            logger.info(
                f"Pencarian Retur validation passed. {len(df)} rows. Columns: {list(df.columns)}"
            )

        except Exception as e:
            os.remove(filepath)
            error_msg = f"Error reading Excel file: {str(e)}"
            logger.error(f"Upload validation error: {error_msg}")
            return jsonify({"success": False, "message": error_msg}), 400

    logger.info(f"File uploaded: {filename} (type: {upload_type})")
    return jsonify(
        {
            "success": True,
            "message": "File uploaded successfully",
            "filepath": filepath,
            "filename": filename,
        }
    )


@app.route("/api/actions/update-retur", methods=["POST"])
@require_api_key
def update_retur():
    """Process uploaded Pencarian Retur file and update waybill retur data."""
    global merge_status
    with merge_lock:
        if merge_status["ongoing"]:
            return jsonify(
                {"success": False, "message": "Update or Merge already in progress"}
            ), 400
        merge_status["ongoing"] = True

    def run_retur_update(retur_file):
        global merge_status
        logger.info(f"Starting retur update with file: {retur_file}")

        merge_status["message"] = "Membaca file Pencarian Retur..."
        merge_status["progress"] = 10
        merge_status["export_file"] = None

        try:
            import pandas as pd

            df = pd.read_excel(retur_file, engine="openpyxl")
            df.columns = [str(col).strip() for col in df.columns]
            total_rows = len(df)

            merge_status["message"] = f"Memproses {total_rows} data retur..."
            merge_status["progress"] = 20

            # Flexible column matching
            def find_col(target, cols):
                def norm(s):
                    return str(s).lower().replace(".", "").replace(" ", "").replace("_", "")

                t_norm = norm(target)
                for c in cols:
                    if norm(c) == t_norm:
                        return c
                return None

            # Identify the actual waybill column
            waybill_col_name = find_col("No. Waybill", df.columns)
            if not waybill_col_name:
                raise Exception(
                    "Gagal identifikasi kolom 'No. Waybill' secara fleksibel."
                )

            # Map the other retur columns
            col_map_targets = {
                "Waktu Register": "waktu_regis_retur",
                "Waktu Konfirmasi": "waktu_konfirmasi_retur",
                "DP Register": "dp_register_retur",
                "Waktu tolak": "waktu_tolak",
                "DP tolak": "dp_tolak",
                "Alasan penolakan": "alasan_penolakan",
                "Status Void": "status_void",
                "Waktu Void": "waktu_void",
                "DP Void": "dp_void_retur",
            }

            active_cols = {}
            for excel_label, db_col in col_map_targets.items():
                found_col = find_col(excel_label, df.columns)
                if found_col:
                    active_cols[found_col] = db_col

            # Waktu Register and DP Register specifically for reporting missing ones
            waktu_reg_col = find_col("Waktu Register", df.columns) or "Waktu Register"
            dp_reg_col = find_col("DP Register", df.columns) or "DP Register"

            conn = get_db_connection()
            if not conn:
                raise Exception("Database connection failed")

            cursor = conn.cursor()

            matched_active = 0
            matched_history = 0
            not_found = 0
            missing_waybills_list = []

            for idx, row in df.iterrows():
                waybill = str(row.get(waybill_col_name, "")).strip()
                if not waybill:
                    continue

                # Build SET clause and values - only for non-empty fields
                set_parts = []
                values = []
                for excel_col, db_col in active_cols.items():
                    val = row.get(excel_col)
                    # Skip NaN / None
                    if pd.isna(val):
                        continue
                    # Convert to string exactly as-is, preserving original timestamp
                    str_val = str(val).strip()
                    if not str_val or str_val.lower() == "nan":
                        continue
                    set_parts.append(f"{db_col} = %s")
                    values.append(str_val)

                if not set_parts:
                    continue

                set_clause = ", ".join(set_parts)

                # Try update in shipments (active)
                cursor.execute(
                    f"UPDATE shipments SET {set_clause} WHERE waybill_id = %s",
                    values + [waybill],
                )
                if cursor.rowcount > 0:
                    matched_active += 1
                else:
                    # Double-check if waybill exists but no data was changed
                    cursor.execute(
                        "SELECT 1 FROM shipments WHERE waybill_id = %s", [waybill]
                    )
                    if cursor.fetchone():
                        matched_active += 1
                    else:
                        # Waybill not in active, try update in shipments_histories
                        cursor.execute(
                            f"UPDATE shipments_histories SET {set_clause} WHERE waybill_id = %s",
                            values + [waybill],
                        )
                        if cursor.rowcount > 0:
                            matched_history += 1
                        else:
                            # Double-check if waybill exists in history but no data was changed
                            cursor.execute(
                                "SELECT 1 FROM shipments_histories WHERE waybill_id = %s",
                                [waybill],
                            )
                            if cursor.fetchone():
                                matched_history += 1
                            else:
                                not_found += 1
                                # Truly missing waybill - collect context for the report
                                missing_waybills_list.append(
                                    {
                                        "No. Waybill": waybill,
                                        "Waktu Register": row.get(waktu_reg_col, "-"),
                                        "DP Register": row.get(dp_reg_col, "-"),
                                        "Keterangan": "Tidak ditemukan di database (Aktif/Histori)",
                                    }
                                )

                # Progress update every 100 rows
                if (idx + 1) % 100 == 0:
                    progress = 20 + int(70 * (idx + 1) / total_rows)
                    merge_status["progress"] = min(progress, 90)
                    merge_status["message"] = f"Memproses {idx + 1}/{total_rows}..."

            conn.commit()
            cursor.close()
            close_connection(conn)

            total_matched = matched_active + matched_history

            export_filename = None
            if missing_waybills_list:
                # Generate Excel for missing waybills
                export_dir = os.path.join(
                    os.path.dirname(os.path.abspath(__file__)), "exports"
                )
                os.makedirs(export_dir, exist_ok=True)

                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                export_filename = f"missing_retur_{timestamp}.xlsx"
                export_path = os.path.join(export_dir, export_filename)

                missing_df = pd.DataFrame(missing_waybills_list)
                missing_df.to_excel(export_path, index=False)
                logger.info(f"Report missing waybills generated: {export_path}")

            merge_status["progress"] = 100
            merge_status["export_file"] = export_filename
            merge_status["message"] = (
                f"Update Retur Selesai: {total_matched} waybill diupdate "
                f"({matched_active} aktif, {matched_history} histori), "
                f"{not_found} tidak ditemukan di database"
            )
            logger.info(merge_status["message"])

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            merge_status["message"] = error_msg
            merge_status["progress"] = 0
            logger.error(f"Retur update failed: {e}", exc_info=True)
        finally:
            merge_status["ongoing"] = False

    try:
        # Find the most recent retur file
        uploads_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"
        )
        retur_file = None

        if os.path.exists(uploads_dir):
            for file in os.listdir(uploads_dir):
                if (
                    "retur" in file.lower()
                    and file.endswith(".xlsx")
                    and not file.startswith("~$")
                ):
                    filepath = os.path.join(uploads_dir, file)
                    if not retur_file or os.path.getmtime(filepath) > os.path.getmtime(
                        retur_file
                    ):
                        retur_file = filepath

        if not retur_file:
            return jsonify(
                {
                    "success": False,
                    "message": "File Pencarian Retur tidak ditemukan. Silakan unggah terlebih dahulu.",
                }
            ), 400

        import threading

        thread = threading.Thread(target=run_retur_update, args=(retur_file,))
        thread.daemon = True
        thread.start()

        logger.info("Retur update process started in background")
        return jsonify({"success": True, "message": "Proses update retur dimulai..."})

    except Exception as e:
        logger.error(f"Error starting retur update: {e}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/actions/manual-end-status", methods=["POST"])
@require_api_key
def manual_end_status():
    """Manually move an active shipment to history with VOID reason."""
    data = request.json or {}
    waybill_id = data.get("waybill_id")
    jenis_scan = data.get("jenis_scan")
    feedback = data.get("feedback", "")

    if not waybill_id or not jenis_scan:
        return jsonify(
            {"success": False, "message": "Waybill ID and Jenis Scan are required"}
        ), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # 1. Check if waybill exists in shipments
        cursor.execute("SELECT * FROM shipments WHERE waybill_id = %s", (waybill_id,))
        shipment = cursor.fetchone()

        if not shipment:
            return jsonify(
                {
                    "success": False,
                    "message": f"Waybill {waybill_id} tidak ditemukan di daftar Aktif",
                }
            ), 404

        # 2. Prepare data for history
        now = datetime.now()
        shipment["jenis_scan"] = jenis_scan
        shipment["alasan_masalah"] = "VOID PENGOPERASIAN"
        shipment["last_status_sync_at"] = now
        shipment["feedback"] = feedback
        shipment["archived_at"] = now
        shipment["archive_reason"] = f"Manual End Status: {jenis_scan} (User Request)"

        # 3. Move to history (Insert into histories)
        # Ensure we only include columns that exist in shipments_histories
        # But we know they match + archived_at/archive_reason
        columns = list(shipment.keys())
        placeholders = ", ".join(["%s"] * len(columns))
        cols_str = ", ".join(columns)
        vals = [shipment.get(col) for col in columns]

        # Use REPLACE INTO for history to avoid duplicates
        cursor.execute(
            f"REPLACE INTO shipments_histories ({cols_str}) VALUES ({placeholders})",
            vals,
        )

        # 4. Delete from active
        cursor.execute("DELETE FROM shipments WHERE waybill_id = %s", (waybill_id,))

        conn.commit()
        cursor.close()
        close_connection(conn)

        logger.info(f"Manual VOID performed for waybill: {waybill_id}")
        return jsonify(
            {
                "success": True,
                "message": f"Waybill {waybill_id} berhasil di-VOID dan dipindah ke Histori.",
            }
        )

    except Exception as e:
        logger.error(f"Error during manual end status: {e}", exc_info=True)
        if conn:
            conn.rollback()
            close_connection(conn)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/actions/download-report/<filename>")
def download_report(filename):
    """Serve generated export files from the exports directory."""
    export_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exports")
    # Use secure_filename if security is a concern, but here we strictly serve from export_dir
    return send_from_directory(export_dir, filename, as_attachment=True)


@app.route("/api/automation/sync", methods=["POST"])
@require_api_key
def run_automation_sync():
    """Trigger automated download and sync from JMS"""
    global merge_status

    with merge_lock:
        if merge_status["ongoing"]:
            return jsonify(
                {"success": False, "message": "A process is already running"}
            ), 400
        merge_status["ongoing"] = True

    merge_status["progress"] = 0
    merge_status["message"] = "Starting JMS Automation..."

    def sync_callback(msg):
        global merge_status
        merge_status["message"] = msg
        logger.info(f"Automation Status: {msg}")

    # Get dates from request
    data = request.json or {}
    start_date = data.get("start_date")
    end_date = data.get("end_date")

    def run_sync():
        global merge_status
        try:
            from automation.automation_orchestrator import AutomationOrchestrator
            from datetime import datetime

            orchestrator = AutomationOrchestrator()

            # Use provided dates or default to today
            today = datetime.now().strftime("%Y-%m-%d")
            s_date = start_date or today
            e_date = end_date or today

            # Start sync
            result = orchestrator.full_sync(
                s_date, e_date, status_callback=sync_callback
            )

            if result.get("success"):
                merge_status["progress"] = 100
                merge_status["message"] = "Completed: " + result.get(
                    "message", "Data synchronized successfully"
                )
            else:
                merge_status["progress"] = 0
                merge_status["message"] = f"Failed: {result.get('error')}"

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            merge_status["message"] = error_msg
            merge_status["progress"] = 0
            logger.error(f"Automation process failed: {e}", exc_info=True)
        finally:
            merge_status["ongoing"] = False

    # Run in background thread
    thread = threading.Thread(target=run_sync)
    thread.daemon = True
    thread.start()

    logger.info("Automation sync process started in background thread")
    return jsonify({"success": True, "message": "Automation sync process started"})


@app.route("/api/shipments/<waybill_id>/feedbacks", methods=["GET"])
def get_waybill_feedbacks(waybill_id):
    """Get all feedbacks for a specific waybill, ordered by newest first."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, waybill_id, reported_by, feedback_text, created_at 
            FROM waybill_feedbacks 
            WHERE waybill_id = %s 
            ORDER BY created_at DESC
        """,
            (waybill_id,),
        )
        feedbacks = cursor.fetchall()

        cursor.close()
        close_connection(conn)

        return jsonify({"success": True, "data": feedbacks})
    except Exception as e:
        logger.error(f"Error fetching feedbacks for {waybill_id}: {e}", exc_info=True)
        if conn:
            close_connection(conn)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/shipments/<waybill_id>/feedbacks", methods=["POST"])
def add_waybill_feedback(waybill_id):
    """Add a new feedback for a specific waybill."""
    data = request.json or {}
    reported_by = data.get("reported_by", "").strip()
    feedback_text = data.get("feedback_text", "").strip()

    if not reported_by or not feedback_text:
        return jsonify(
            {
                "success": False,
                "message": "Nama PIC (reported_by) dan Pesan (feedback_text) wajib diisi.",
            }
        ), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO waybill_feedbacks (waybill_id, reported_by, feedback_text)
            VALUES (%s, %s, %s)
        """,
            (waybill_id, reported_by, feedback_text),
        )

        new_id = cursor.lastrowid
        conn.commit()

        # Fetch the newly created record to return
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM waybill_feedbacks WHERE id = %s", (new_id,))
        new_feedback = cursor.fetchone()

        cursor.close()
        close_connection(conn)

        return jsonify(
            {
                "success": True,
                "message": "Feedback berhasil ditambahkan.",
                "data": new_feedback,
            }
        )
    except Exception as e:
        logger.error(f"Error adding feedback for {waybill_id}: {e}", exc_info=True)
        if conn:
            conn.rollback()
            close_connection(conn)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/feedbacks/<int:feedback_id>", methods=["PUT"])
def update_waybill_feedback(feedback_id):
    """Update an existing feedback."""
    data = request.json or {}
    feedback_text = data.get("feedback_text", "").strip()

    if not feedback_text:
        return jsonify(
            {"success": False, "message": "Pesan (feedback_text) wajib diisi."}
        ), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE waybill_feedbacks 
            SET feedback_text = %s 
            WHERE id = %s
        """,
            (feedback_text, feedback_id),
        )

        if cursor.rowcount == 0:
            return jsonify(
                {"success": False, "message": "Feedback tidak ditemukan."}
            ), 404

        conn.commit()
        cursor.close()
        close_connection(conn)

        return jsonify({"success": True, "message": "Feedback berhasil diupdate."})
    except Exception as e:
        logger.error(f"Error updating feedback {feedback_id}: {e}", exc_info=True)
        if conn:
            conn.rollback()
            close_connection(conn)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/feedbacks/<int:feedback_id>", methods=["DELETE"])
def delete_waybill_feedback(feedback_id):
    """Delete an existing feedback."""
    conn = get_db_connection()
    if not conn:
        return jsonify({"success": False, "message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM waybill_feedbacks WHERE id = %s", (feedback_id,))

        if cursor.rowcount == 0:
            return jsonify(
                {"success": False, "message": "Feedback tidak ditemukan."}
            ), 404

        conn.commit()
        cursor.close()
        close_connection(conn)

        return jsonify({"success": True, "message": "Feedback berhasil dihapus."})
    except Exception as e:
        logger.error(f"Error deleting feedback {feedback_id}: {e}", exc_info=True)
        if conn:
            conn.rollback()
            close_connection(conn)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/feedbacks/bulk", methods=["POST"])
def add_bulk_feedback():
    """Bulk upload feedbacks via Excel/CSV"""
    if "file" not in request.files:
        return jsonify(
            {"success": False, "message": "Tidak ada file yang diunggah"}
        ), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"success": False, "message": "File tidak valid"}), 400

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file)
        else:
            df = pd.read_excel(file)

        if df.empty:
            return jsonify({"success": False, "message": "File kosong"}), 400

        # Cari kolom waybill dan feedback secara dinamis

        waybill_col = next(
            (
                c
                for c in df.columns
                if "waybill" in str(c).lower() or "resi" in str(c).lower()
            ),
            None,
        )
        feedback_col = next(
            (
                c
                for c in df.columns
                if "feedback" in str(c).lower() or "catatan" in str(c).lower()
            ),
            None,
        )

        if not waybill_col or not feedback_col:
            # Fallback ke kolom 1 dan 2 jika nama kolom tidak standar
            if len(df.columns) >= 2:
                waybill_col = df.columns[0]
                feedback_col = df.columns[1]
            else:
                return jsonify(
                    {
                        "success": False,
                        "message": "Format kolom tidak sesuai. Harap gunakan kolom 'Nomor Waybill' dan 'Feedback'",
                    }
                ), 400

        def formalize_text(text):
            if pd.isna(text):
                return ""
            t = str(text).strip()
            if not t:
                return ""
            return t[0].upper() + t[1:]

        conn = get_db_connection()
        if not conn:
            return jsonify(
                {"success": False, "message": "Database connection failed"}
            ), 500

        try:
            cursor = conn.cursor()

            # 1. Ambil semua unique waybill dari file untuk validasi massal
            unique_wbs_in_file = list(
                set(
                    [
                        str(row[waybill_col]).strip().upper()
                        for _, row in df.iterrows()
                        if pd.notna(row[waybill_col])
                    ]
                )
            )
            existing_wbs = set()

            if unique_wbs_in_file:
                # Chunking untuk menghindari limit parameter SQL (1000 per query)
                chunk_size = 1000
                for i in range(0, len(unique_wbs_in_file), chunk_size):
                    chunk = unique_wbs_in_file[i : i + chunk_size]
                    format_strings = ",".join(["%s"] * len(chunk))

                    # Cek di tabel Aktif
                    cursor.execute(
                        f"SELECT waybill_id FROM shipments WHERE waybill_id IN ({format_strings})",
                        tuple(chunk),
                    )
                    for row in cursor.fetchall():
                        existing_wbs.add(row[0])

                    # Cek di tabel Histori
                    cursor.execute(
                        f"SELECT waybill_id FROM shipments_histories WHERE waybill_id IN ({format_strings})",
                        tuple(chunk),
                    )
                    for row in cursor.fetchall():
                        existing_wbs.add(row[0])

            # 2. Filter data yang akan dimasukkan (Hanya yang ada di DB)
            data_to_insert = []
            skipped_count = 0
            for _, row in df.iterrows():
                wb = str(row[waybill_col]).strip().upper()
                fb = formalize_text(row[feedback_col])

                if wb and fb and wb.lower() != "nan" and fb.lower() != "nan":
                    if wb in existing_wbs:
                        data_to_insert.append((wb, "SYSTEM", fb))
                    else:
                        skipped_count += 1

            if not data_to_insert:
                cursor.close()
                close_connection(conn)
                return jsonify(
                    {
                        "success": False,
                        "message": f"Gagal Impor. Semua resi ({skipped_count}) tidak ditemukan di database Bewa.",
                    }
                ), 400

            # 3. Eksekusi Batch Insert
            query = "INSERT INTO waybill_feedbacks (waybill_id, reported_by, feedback_text) VALUES (%s, %s, %s)"
            cursor.executemany(query, data_to_insert)
            conn.commit()

            inserted_count = cursor.rowcount
            cursor.close()
            close_connection(conn)

            logger.info(
                f"Bulk feedback: {inserted_count} inserted, {skipped_count} skipped"
            )

            msg = f"Berhasil mengimpor {inserted_count} feedback."
            if skipped_count > 0:
                msg += (
                    f" {skipped_count} resi diabaikan karena tidak terdaftar di sistem."
                )

            return jsonify({"success": True, "message": msg})
        except Exception as db_err:
            if conn:
                conn.rollback()
                close_connection(conn)
            raise db_err

    except Exception as e:
        logger.error(f"Error processing bulk feedback: {e}", exc_info=True)
        return jsonify(
            {"success": False, "message": f"Gagal membaca file: {str(e)}"}
        ), 500


@app.route("/api/auto-feedback", methods=["POST"])
def auto_feedback_processor():
    """Process an uploaded Excel file to auto-generate feedback for 5000+ waybills."""
    if "file" not in request.files:
        return jsonify(
            {"success": False, "message": "Tidak ada file yang diunggah"}
        ), 400

    file = request.files["file"]
    if not file.filename.endswith((".xls", ".xlsx")):
        return jsonify(
            {"success": False, "message": "Format file harus Excel (.xls, .xlsx)"}
        ), 400

    try:
        df = pd.read_excel(file)
    except Exception as e:
        return jsonify(
            {"success": False, "message": f"Gagal membaca Excel: {str(e)}"}
        ), 400

    # Cari kolom resi
    waybill_col = None
    for col in df.columns:
        if isinstance(col, str):
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in ["waybill", "awb", "resi"]):
                waybill_col = col
                break

    if not waybill_col:
        return jsonify(
            {
                "success": False,
                "message": "Kolom bernama 'Resi', 'AWB', atau 'Waybill' tidak ditemukan di file Excel",
            }
        ), 400

    # Normalisasi
    df["_normalized_wb"] = df[waybill_col].astype(str).str.strip().str.upper().str.replace(r'\.0$', '', regex=True)
    unique_wbs = [
        wb
        for wb in df["_normalized_wb"].unique().tolist()
        if wb and wb.lower() != "nan"
    ]

    wb_info_dict = {}
    db_feedback_dict = {}

    active_dps = [
        "MABA",
        "BULI",
        "WASILE",
        "SOFIFI",
        "LABUHA",
        "FALAJAWA2",
        "SANANA",
        "BOBONG",
    ]

    if unique_wbs:
        conn = get_db_connection()
        if conn:
            try:
                cursor = conn.cursor(dictionary=True)
                chunk_size = 1000
                for i in range(0, len(unique_wbs), chunk_size):
                    chunk = unique_wbs[i : i + chunk_size]
                    format_strings = ",".join(["%s"] * len(chunk))

                    # Ambil data lengkap + Identifikasi Tabel (Aktif vs Histori)
                    cursor.execute(
                        f"""
                        SELECT waybill_id, waktu_sampai, station_scan, jenis_scan, alasan_masalah, end_status, 'ACTIVE' as location 
                        FROM shipments WHERE waybill_id IN ({format_strings})
                        UNION ALL
                        SELECT waybill_id, waktu_sampai, station_scan, jenis_scan, alasan_masalah, end_status, 'HISTORY' as location 
                        FROM shipments_histories WHERE waybill_id IN ({format_strings})
                    """,
                        tuple(chunk + chunk),
                    )
                    for row in cursor.fetchall():
                        # Aktif diprioritaskan jika ada duplikat ID di kedua tabel
                        if (
                            row["waybill_id"] not in wb_info_dict
                            or row["location"] == "ACTIVE"
                        ):
                            wb_info_dict[row["waybill_id"]] = row

                    # Ambil list pesan histori chat (Feedback Database)
                    cursor.execute(
                        f"""
                        SELECT waybill_id, feedback_text 
                        FROM waybill_feedbacks 
                        WHERE waybill_id IN ({format_strings})
                        ORDER BY created_at ASC
                    """,
                        tuple(chunk),
                    )
                    for row in cursor.fetchall():
                        db_feedback_dict[row["waybill_id"]] = row["feedback_text"]

                cursor.close()
            except Exception as e:
                logger.error(f"Error checking db for auto-feedback: {e}", exc_info=True)
            finally:
                close_connection(conn)

    today = pd.Timestamp.now().normalize()
    months_id = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
    ]

    def generate_feedback(wb):
        if not wb or wb.lower() == "nan":
            return ""

        if wb not in wb_info_dict:
            return "Resi tidak ditemukan di sistem Bewa"

        info = wb_info_dict[wb]
        location = info["location"]
        waktu_sampai_raw = info["waktu_sampai"]
        station_scan = (info["station_scan"] or "").strip().upper()
        jenis_scan = (info["jenis_scan"] or "").strip().upper()
        alasan = (info["alasan_masalah"] or "").strip()
        end_status = (info["end_status"] or "").strip()

        # LOGIKA 1: JIKA DATA ADA DI HISTORI
        if location == "HISTORY":
            prioritas_catatan = ""
            if wb in db_feedback_dict and db_feedback_dict[wb]:
                prioritas_catatan = f"Catatan Bewa Terakhir: {db_feedback_dict[wb].strip()} | Status Sistem: "

            # Cek apakah station scan bukan 8 Drop Point Aktif
            if station_scan and station_scan not in active_dps:
                return prioritas_catatan + f"paket sudah di {station_scan}"

            # Jika station scan ada di 8 DP, cek status scan
            if "TTD" in jenis_scan or end_status:
                return prioritas_catatan + "paket sudah end status"
            elif "BERMASALAH" in jenis_scan:
                return prioritas_catatan + f"paket bermasalah dengan alasan : {alasan}"
            else:
                # Default histori jika tidak masuk kriteria spesifik di atas
                return prioritas_catatan + f"paket sudah di {station_scan}"

        # LOGIKA 2: JIKA DATA AKTIF (LOGIKA UMUR)
        if not waktu_sampai_raw or str(waktu_sampai_raw).lower() in (
            "null",
            "none",
            "nan",
            "",
            "0001-01-01 00:00:00",
            "0001-01-01",
        ) or str(waktu_sampai_raw).startswith("0001-01-01"):
            return "Paket belum memiliki waktu sampai di data Drop Point"

        try:
            ws_str = str(waktu_sampai_raw)
            if "(Waktu" in ws_str:
                ws_str = ws_str.split("(Waktu")[0].strip()
            if "GMT" in ws_str:
                ws_str = ws_str.split("GMT")[0].strip()

            dt_sampai = pd.to_datetime(ws_str, errors="coerce")
            if pd.isna(dt_sampai):
                return "Gagal membaca format waktu sampai"

            dt_sampai = dt_sampai.normalize().tz_localize(None)
            delta_days = (today - dt_sampai).days

            tgl_formatted = f"{dt_sampai.day:02d} {months_id[dt_sampai.month - 1]}"

            # PRIORITAS: CEK CATATAN HARIAN (Log Obrolan)
            if wb in db_feedback_dict and db_feedback_dict[wb]:
                catatan = db_feedback_dict[wb].strip()
                # Coba gunakan AI Lokal (Ollama) untuk memperhalus bahasa
                return get_ai_refined_feedback(station_scan, tgl_formatted, catatan)

            prefix = f"paket sampai di DP {station_scan} tanggal {tgl_formatted}, "

            if delta_days <= 2:
                return (
                    prefix
                    + "paket akan di maksimalkan sukses jika tidak akan di lakukan retur sesuai sop"
                )
            elif delta_days in (3, 4):
                return prefix + "paket akan di maksimalkan retur hari ini"
            else:
                if wb in db_feedback_dict:
                    return prefix + db_feedback_dict[wb]
                else:
                    return (
                        prefix
                        + "paket akan di lakukan pengecekan fisik dan akan di tangani sesuai masalah"
                    )
        except Exception:
            return "Gagal mengkalkulasi umur paket"

    df["feedback saya"] = df["_normalized_wb"].apply(generate_feedback)
    del df["_normalized_wb"]

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)

    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="Bewa_Auto_Feedback.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def get_ai_refined_feedback(station, tanggal, catatan):
    """
    Panggil API Ollama Lokal untuk memperhalus teks feedback.
    Jika Ollama belum aktif, gunakan template standar sebagai fallback.
    """
    try:
        import requests

        # Timeout singkat (3.5 detik) agar tidak menghambat proses Excel jika AI sedang sibuk
        url = "http://localhost:11434/api/generate"
        prompt = (
            f"Sebagai asisten logistik yang memberikan LAPORAN STATUS kepada ATASAN, "
            f"ubah catatan singkat ini menjadi satu kalimat laporan formal dan sangat ringkas.\n"
            f"Data: Paket tiba di DP {station} pada {tanggal}. Update: {catatan}.\n"
            f"Aturan: Langsung pada intinya. JANGAN gunakan kata 'Anda', 'Terima kasih', 'Mohon', "
            f"atau 'Sesuai catatan operasional'. Cukup sampaikan fakta statusnya saja. "
            f"Berikan HANYA hasil kalimatnya saja."
        )

        payload = {
            "model": "llama3",
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": 60, "temperature": 0.7},
        }

        response = requests.post(url, json=payload, timeout=3.5)
        if response.status_code == 200:
            result = response.json()
            ai_text = result.get("response", "").strip()
            if ai_text:
                # Hilangkan tanda kutip jika ada
                return ai_text.replace('"', "").replace("'", "")
    except Exception:
        pass

    # Fallback jika AI belum aktif atau terjadi error
    return f"paket sampai di DP {station} tanggal {tanggal}. Update: {catatan}"


# --- SPA Routing Catch-All ---
@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith('/api/'):
        return jsonify({"success": False, "message": "API endpoint not found"}), 404
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("BEWA LOGISTICS WEB SERVER")
    logger.info("=" * 60)
    logger.info(f"Base Directory: {BASE_DIR}")
    logger.info(f"Database: {BEWA_DB_CONFIG.get('database', 'N/A')}")
    logger.info("Server: http://localhost:5000")
    logger.info("=" * 60)

    app.run(host="0.0.0.0", port=5000, debug=True)
