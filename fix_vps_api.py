import paramiko

def fix_api():
    hostname = "72.62.120.102"
    username = "root"
    password = "passwordE@25"

    print("[*] Connecting to VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname, username=username, password=password, timeout=10)
    
    # Let's fix the api.js to ensure PROD check works
    # Node environments on VPS might not always pass import.meta.env.PROD reliably if not built correctly
    script = """
cat << 'EOF' > /var/www/bewa/web/frontend/src/services/api.js
const getApiBaseUrl = () => {
  // Hardcode relative path for production
  return ''; 
};

const API_BASE = getApiBaseUrl();

const getApiKey = () => {
  const envKey = import.meta.env.VITE_BEWA_API_KEY || 'bewa-internal-2026';
  const stored = localStorage.getItem('bewa_api_key');
  return (stored && stored.length > 5) ? stored : envKey;
};

const protectedHeaders = () => ({
  'Content-Type': 'application/json',
  'X-API-Key': getApiKey(),
});

export const setApiKey = (key) => {
  localStorage.setItem('bewa_api_key', key);
};

export const fetchStats = async () => {
  const res = await fetch(`${API_BASE}/api/stats`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const fetchSummary = async () => {
  const res = await fetch(`${API_BASE}/api/report/summary`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const fetchDatabase = async (page = 1, limit = 100) => {
  const res = await fetch(`${API_BASE}/api/report/database?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const fetchAllDatabase = async () => {
  const res = await fetch(`${API_BASE}/api/report/database?page=1&limit=50000`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const fetchMonitoringMonths = async () => {
  const res = await fetch(`${API_BASE}/api/report/monitoring-months`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const fetchDailyProgress = async () => {
  const res = await fetch(`${API_BASE}/api/report/daily-progress`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const resetDatabase = async () => {
  const res = await fetch(`${API_BASE}/api/actions/reset-db`, {
    method: 'POST',
    headers: protectedHeaders()
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error: ${res.status}`);
  }
  return res.json();
};

export const triggerMerge = async () => {
  const res = await fetch(`${API_BASE}/api/actions/merge`, {
    method: 'POST',
    headers: protectedHeaders()
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error: ${res.status}`);
  }
  return res.json();
};

export const checkMergeStatus = async () => {
  const res = await fetch(`${API_BASE}/api/actions/status`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const trackWaybill = async (waybill) => {
  const res = await fetch(`${API_BASE}/api/tracking/lookup?waybill=${waybill}`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const uploadData = async (type, formData) => {
  formData.append('type', type);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Failed to upload ${type}`);
  return res.json();
};

export const fetchBatchWaybills = async () => {
  const res = await fetch(`${API_BASE}/api/shipments/active/batch-download`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const updateStatusTerupdate = async () => {
  const res = await fetch(`${API_BASE}/api/actions/update-status`, {
    method: 'POST',
    headers: protectedHeaders()
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error: ${res.status}`);
  }
  return res.json();
};

export const fetchAgingDetails = async (limit = 99999) => {
  const res = await fetch(`${API_BASE}/api/report/aging-details?limit=${limit}`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const updateRetur = async () => {
  const res = await fetch(`${API_BASE}/api/actions/update-retur`, {
    method: 'POST',
    headers: protectedHeaders()
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error: ${res.status}`);
  }
  return res.json();
};

export const manualEndStatus = async (waybill, jenisScan, feedback = '') => {
  const res = await fetch(`${API_BASE}/api/actions/manual-end-status`, {
    method: 'POST',
    headers: protectedHeaders(),
    body: JSON.stringify({ 
      waybill_id: waybill, 
      jenis_scan: jenisScan,
      feedback: feedback
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error: ${res.status}`);
  }
  return res.json();
};

export const fetchWaybillFeedbacks = async (waybill) => {
  const res = await fetch(`${API_BASE}/api/shipments/${waybill}/feedbacks`);
  if (!res.ok) throw new Error('API Error');
  return res.json();
};

export const addWaybillFeedback = async (waybill, reportedBy, feedbackText) => {
  const res = await fetch(`${API_BASE}/api/shipments/${waybill}/feedbacks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reported_by: reportedBy,
      feedback_text: feedbackText
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error: ${res.status}`);
  }
  return res.json();
};

export const updateWaybillFeedback = async (feedbackId, feedbackText) => {
  const res = await fetch(`${API_BASE}/api/feedbacks/${feedbackId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      feedback_text: feedbackText
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error: ${res.status}`);
  }
  return res.json();
};

export const deleteWaybillFeedback = async (feedbackId) => {
  const res = await fetch(`${API_BASE}/api/feedbacks/${feedbackId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API Error: ${res.status}`);
  }
  return res.json();
};

export const uploadAutoFeedback = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/api/auto-feedback`, {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({ message: 'Gagal memproses file' }));
    throw new Error(errorJson.message || `API Error: ${res.status}`);
  }
  
  return await res.blob();
};

export const uploadBulkFeedback = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/api/feedbacks/bulk`, {
    method: 'POST',
    body: formData
  });
  
  const data = await res.json().catch(() => ({ message: 'Gagal memproses file bulk upload' }));
  if (!res.ok) {
    throw new Error(data.message || `API Error: ${res.status}`);
  }
  
  return data;
};
EOF

echo "[*] Rebuilding frontend..."
cd /var/www/bewa/web/frontend
npm run build

echo "[*] Restarting services..."
systemctl restart bewa
systemctl restart nginx
"""

    stdin, stdout, stderr = client.exec_command(script, get_pty=True)
    
    # Print real-time output
    for line in iter(stdout.readline, ""):
        print(line, end="")

    print("[+] API config updated and services restarted.")
    client.close()

if __name__ == "__main__":
    fix_api()
