import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, X } from 'lucide-react';

export const UploadPod = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${apiUrl}/api/actions/sync-incoming-pod`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Terjadi kesalahan saat upload.');
      }
      
      setStatus('success');
      setMessage(data.message || 'File berhasil diproses.');
      setFile(null);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Terjadi kesalahan saat upload.');
    }
  };

  return (
    <div className="animate-in upload-container">
      <div className="card-header">
        <div>
          <h1 className="card-title">Upload Data POD Incoming</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Unggah file Excel <strong>Pencarian Waybill Incoming</strong> untuk sinkronisasi Sprinter Delivery Harian.
          </p>
        </div>
      </div>

      <div className="card glass">
        <div 
          className="upload-zone" 
          style={{ cursor: 'pointer' }}
          onClick={() => document.getElementById('podFile').click()}
        >
          <input
            type="file"
            id="podFile"
            className="hidden"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div className="flex flex-col items-center">
            <div className="upload-icon-container">
              <UploadCloud size={48} />
            </div>
            <p className="sidebar-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Pilih File Excel/CSV</p>
            <p className="upload-text">atau seret file ke sini untuk mulai sinkronisasi</p>
          </div>
        </div>
        
        {file && (
          <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ color: 'var(--primary)' }}><CheckCircle size={24} /></div>
              <div>
                <p style={{ fontWeight: 600 }}>{file.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleUpload}
            disabled={!file || status === 'uploading'}
            className="btn btn-primary"
            style={{ padding: '0.75rem 2rem' }}
          >
            {status === 'uploading' ? 'Memproses...' : 'Mulai Sinkronisasi'}
          </button>
        </div>

        {status === 'success' && (
          <div style={{ marginTop: '2rem' }} className="status-indicator">
            <div className="status-dot"></div>
            <p style={{ color: 'var(--success)', fontWeight: 600 }}>{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ marginTop: '2rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} style={{ color: 'var(--danger)' }} />
            <p style={{ color: '#f87171', fontSize: '0.875rem' }}>{message}</p>
          </div>
        )}
      </div>
    </div>
  );
};
