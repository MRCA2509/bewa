const getApiBaseUrl = () => {
  // Use relative path for production if hosted together, otherwise from env
  if (import.meta.env.PROD) return ''; 
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
};

const API_BASE = getApiBaseUrl();

/**
 * Get the API key from environment or local storage.
 */
const getApiKey = () => {
  const envKey = import.meta.env.VITE_BEWA_API_KEY || 'bewa-internal-2026';
  const stored = localStorage.getItem('bewa_api_key');
  return (stored && stored.length > 5) ? stored : envKey;
};

/**
 * Headers for protected (destructive) endpoints
 */
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
  // Use a higher limit for global monitoring (50k records) to ensure older months aren't cut off
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
