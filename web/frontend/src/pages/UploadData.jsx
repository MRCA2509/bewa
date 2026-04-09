import React, { useState, useRef, useEffect } from 'react';
import { Upload, RefreshCcw, CheckCircle, X, Activity, Database, AlertCircle, FileUp, RotateCcw, Lock } from 'lucide-react';
import { uploadData, triggerMerge, checkMergeStatus, resetDatabase, fetchStats, updateStatusTerupdate, updateRetur } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export const UploadData = () => {
  const [uploadedFiles, setUploadedFiles] = useState({ monitor: null, status: null, retur: null });
  const [uploadingType, setUploadingType] = useState(null);
  const [mergeStatus, setMergeStatus] = useState({ ongoing: false, message: 'Idle', progress: 0 });

  const monitorFileInput = useRef(null);
  const statusFileInput = useRef(null);
  const returFileInput = useRef(null);

  const { user } = useAuth();

  useEffect(() => {
    let interval;
    if (mergeStatus.ongoing) {
      interval = setInterval(checkStatus, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mergeStatus.ongoing]);

  const checkStatus = async () => {
    try {
      const data = await checkMergeStatus();
      if (data.success) {
        setMergeStatus(data.status);
        if (!data.status.ongoing && (data.status.message.includes('Completed') || data.status.message.includes('Selesai'))) {
          toast.success(data.status.message, { duration: 6000 });
        }
      }
    } catch (e) {
      console.error('Error checking merge status', e);
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      toast.error('Gunakan file Excel (.xlsx)');
      return;
    }

    setUploadingType(type);
    const formData = new FormData();
    formData.append('file', file);

    const loadingToast = toast.loading(`Mengunggah file ${type}...`);

    try {
      const data = await uploadData(type, formData);
      if (data.success) {
        setUploadedFiles(prev => ({ ...prev, [type]: file }));
        toast.success(`Upload berhasil: ${data.message}`, { id: loadingToast });
      } else {
        toast.error(`Upload gagal: ${data.message}`, { id: loadingToast });
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat mengunggah', { id: loadingToast });
    } finally {
      setUploadingType(null);
      if (type === 'monitor' && monitorFileInput.current) monitorFileInput.current.value = '';
      if (type === 'status' && statusFileInput.current) statusFileInput.current.value = '';
      if (type === 'retur' && returFileInput.current) returFileInput.current.value = '';
    }
  };

  const handleMerge = async () => {
    try {
      const data = await triggerMerge();
      if (data.success) {
        setMergeStatus({ ongoing: true, message: 'Starting merge...', progress: 0 });
        toast('Info: Proses merge dimulai...', { icon: '⚙️' });
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error('Error starting merge');
    }
  };

  const handleUpdateStatus = async () => {
    if (!uploadedFiles.status) {
      toast.error("Silakan unggah file Status Sinkron (JMS) terlebih dahulu");
      return;
    }

    try {
      const data = await updateStatusTerupdate();
      if (data.success) {
        setMergeStatus({ ongoing: true, message: 'Memulai sinkronisasi JMS di server...', progress: 10 });
        toast.success('Pembaruan JMS dimulai di latar belakang');
      } else {
        toast.error(data.message || data.error || 'Gagal memulai update');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan saat memulai status update');
    }
  };

  const handleResetDatabase = async () => {
    if (!user || user.role !== 'RM') {
      toast.error("Otorisasi Ditolak: Hanya Regional Manager yang mumpuni melakukan PURGE.");
      return;
    }
    
    if (!window.confirm("⚠️ PERINGATAN: Ini akan menghapus SEMUA data di database secara permanen. Apakah Anda yakin?")) {
      return;
    }
    
    const pwd = window.prompt("Masukkan Security Password RM untuk melanjutkan Purge:");
    if (pwd !== "BEWA-RM-2026" && pwd !== "RM1234!!") {
      toast.error("Akses Ditolak: Password Salah!");
      return;
    }
    
    try {
      const data = await resetDatabase();
      if (data.success) {
        toast.success('Database berhasil dikosongkan!');
        fetchStats();
      } else {
        toast.error(`Gagal mereset database: ${data.message}`);
      }
    } catch (e) {
      toast.error('Terjadi kesalahan sistem saat reset database');
    }
  };

  const handleUpdateRetur = async () => {
    if (!uploadedFiles.retur) {
      toast.error("Silakan unggah file Pencarian Retur terlebih dahulu");
      return;
    }

    try {
      const data = await updateRetur();
      if (data.success) {
        setMergeStatus({ ongoing: true, message: 'Memulai update data retur...', progress: 10 });
        toast.success('Update Retur dimulai di latar belakang');
      } else {
        toast.error(data.message || data.error || 'Gagal memulai update retur');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan saat memulai update retur');
    }
  };

  return (
    <div className="animate-in" style={{ paddingBottom: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Upload Portal Container */}
      <div className="card glass">
        <div className="card-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.75rem', fontWeight: 800 }}>
               <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '1rem', color: 'var(--primary)', boxShadow: 'inset 0 2px 10px rgba(59, 130, 246, 0.1)' }}>
                  <Database size={28} />
               </div>
               Data Ingestion Portal
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', marginLeft: '0.25rem' }}>
               Unggah dataset harian Anda. Sistem akan memvalidasi, menggabungkan, dan memperbarui status paket secara otomatis.
            </p>
          </div>
          <div className="badge badge-green" style={{ animation: 'pulse 2s infinite' }}>
            Portal Active
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          
          {/* ZONE 01: Monitor */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
               <span style={{ width: '28px', height: '28px', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', border: '1px solid rgba(59,130,246,0.3)' }}>01</span>
               Lico Monitor
            </h3>
            <div style={{ flex: 1 }}>
              {uploadedFiles.monitor ? (
                <div className="upload-zone active" style={{ minHeight: '280px' }}>
                  <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '1rem', color: 'var(--success)', marginBottom: '1rem' }}>
                    <CheckCircle size={40} />
                  </div>
                  <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Ready to Process</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', marginBottom: '1.5rem', maxWidth: '90%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                     {uploadedFiles.monitor.name}
                  </div>
                  <button 
                    className="btn" 
                    style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
                    onClick={() => setUploadedFiles(prev => ({ ...prev, monitor: null }))}
                  >
                    <RefreshCcw size={14} /> Ganti File
                  </button>
                </div>
              ) : (
                <label className="upload-zone" style={{ minHeight: '280px', cursor: uploadingType === 'monitor' ? 'not-allowed' : 'pointer', opacity: uploadingType === 'monitor' ? 0.5 : 1 }}>
                  <div className="upload-icon-container">
                     <Upload size={32} style={{ animation: uploadingType === 'monitor' ? 'spin 1s linear infinite' : 'none' }} />
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Upload Monitor</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '200px' }}>Ekspor raw data dari Lico Monitor (.xlsx)</p>
                  <input style={{ display: 'none' }} type="file" onChange={(e) => handleFileUpload(e, 'monitor')} accept=".xlsx" ref={monitorFileInput} disabled={uploadingType === 'monitor'} />
                </label>
              )}
            </div>
          </div>

          {/* ZONE 02: JMS Status */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
               <span style={{ width: '28px', height: '28px', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>02</span>
               JMS Status
            </h3>
            <div style={{ flex: 1 }}>
              {uploadedFiles.status ? (
                <div className="upload-zone active" style={{ minHeight: '280px' }}>
                  <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '1rem', color: 'var(--success)', marginBottom: '1rem' }}>
                    <CheckCircle size={40} />
                  </div>
                  <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Ready to Synchronize</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', marginBottom: '1.5rem', maxWidth: '90%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                     {uploadedFiles.status.name}
                  </div>
                  <button 
                    className="btn" 
                    style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
                    onClick={() => setUploadedFiles(prev => ({ ...prev, status: null }))}
                  >
                    <RefreshCcw size={14} /> Ganti File
                  </button>
                </div>
              ) : (
                <label className="upload-zone" style={{ minHeight: '280px', cursor: uploadingType === 'status' ? 'not-allowed' : 'pointer', opacity: uploadingType === 'status' ? 0.5 : 1 }}>
                  <div className="upload-icon-container">
                     <RotateCcw size={32} style={{ animation: uploadingType === 'status' ? 'spin 1s linear infinite' : 'none' }} />
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Upload JMS</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '200px' }}>Ekspor status sinkron terbaru (.xlsx)</p>
                  <input style={{ display: 'none' }} type="file" onChange={(e) => handleFileUpload(e, 'status')} accept=".xlsx" ref={statusFileInput} disabled={uploadingType === 'status'} />
                </label>
              )}
            </div>
          </div>

          {/* ZONE 03: Retur */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
               <span style={{ width: '28px', height: '28px', borderRadius: '0.5rem', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>03</span>
               Master Retur
            </h3>
            <div style={{ flex: 1 }}>
              {uploadedFiles.retur ? (
                <div className="upload-zone active" style={{ minHeight: '280px' }}>
                  <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '1rem', color: 'var(--success)', marginBottom: '1rem' }}>
                    <CheckCircle size={40} />
                  </div>
                  <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Ready to Verify</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', marginBottom: '1.5rem', maxWidth: '90%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                     {uploadedFiles.retur.name}
                  </div>
                  <button 
                    className="btn" 
                    style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
                    onClick={() => setUploadedFiles(prev => ({ ...prev, retur: null }))}
                  >
                    <RefreshCcw size={14} /> Ganti File
                  </button>
                </div>
              ) : (
                <label className="upload-zone" style={{ minHeight: '280px', cursor: uploadingType === 'retur' ? 'not-allowed' : 'pointer', opacity: uploadingType === 'retur' ? 0.5 : 1 }}>
                  <div className="upload-icon-container">
                     <FileUp size={32} style={{ animation: uploadingType === 'retur' ? 'spin 1s linear infinite' : 'none' }} />
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Upload Retur</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '200px' }}>Pencarian paket retur ke Pusat (.xlsx)</p>
                  <input style={{ display: 'none' }} type="file" onChange={(e) => handleFileUpload(e, 'retur')} accept=".xlsx" ref={returFileInput} disabled={uploadingType === 'retur'} />
                </label>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Progress Monitor Bar */}
      {(mergeStatus.ongoing || mergeStatus.message !== 'Idle') && (
        <div className="card glass" style={{ border: '1px solid var(--primary)', background: 'rgba(59, 130, 246, 0.05)', position: 'relative' }}>
          <div className="progress-bar" style={{ position: 'absolute', top: 0, left: 0, width: '100%', borderRadius: '0' }}>
            <div className="progress-fill" style={{ width: `${mergeStatus.progress}%`, background: mergeStatus.ongoing ? 'var(--primary)' : 'var(--success)' }} />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '1rem', background: mergeStatus.ongoing ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: mergeStatus.ongoing ? 'var(--primary)' : 'var(--success)' }}>
                {mergeStatus.ongoing ? <RefreshCcw size={24} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={24} />}
              </div>
              <div>
                <h4 style={{ color: 'var(--text-main)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{mergeStatus.message}</h4>
                {mergeStatus.ongoing && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Proses sedang berjalan, harap tunggu...</p>}
              </div>
            </div>
            
            {mergeStatus.ongoing && (
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{mergeStatus.progress}%</span>
              </div>
            )}
            
            {mergeStatus.export_file && !mergeStatus.ongoing && (
              <a 
                href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/actions/download-report/${mergeStatus.export_file}`}
                className="btn btn-success"
                target="_blank" rel="noopener noreferrer"
                style={{ padding: '0.75rem 1.5rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}
              >
                <FileUp size={16} /> Unduh Report Hasil (.xlsx)
              </a>
            )}
          </div>
        </div>
      )}

      {/* Control Panel and Danger Zone Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)', gap: '2rem', alignItems: 'stretch' }}>
        
        {/* Core Operations */}
        <div className="card glass" style={{ marginBottom: 0 }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '1rem' }}>
               <Activity size={20} color="var(--primary)" />
               Command Center
            </h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Merge Button */}
            <button 
              className="btn"
              style={{ 
                height: '140px', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                background: (!mergeStatus.ongoing && uploadedFiles.monitor && uploadedFiles.status) ? 'var(--primary)' : 'rgba(30, 41, 59, 0.5)',
                color: (!mergeStatus.ongoing && uploadedFiles.monitor && uploadedFiles.status) ? 'white' : 'var(--text-muted)',
                border: '1px solid var(--glass-border)'
              }}
              onClick={handleMerge} 
              disabled={mergeStatus.ongoing || !uploadedFiles.monitor || !uploadedFiles.status}
            >
              <RefreshCcw size={32} style={{ animation: mergeStatus.ongoing ? 'spin 1s linear infinite' : 'none', marginBottom: '0.5rem' }} />
              <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Merge Data</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem' }}>Satukan Lico & JMS</span>
            </button>
            
            {/* Sync JMS Button */}
            <button 
              className="btn"
              style={{ 
                height: '140px', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                background: (!mergeStatus.ongoing && uploadedFiles.status) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                color: (!mergeStatus.ongoing && uploadedFiles.status) ? 'var(--success)' : 'var(--text-muted)',
                border: (!mergeStatus.ongoing && uploadedFiles.status) ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--glass-border)'
              }}
              onClick={handleUpdateStatus} 
              disabled={mergeStatus.ongoing || !uploadedFiles.status}
            >
              <RotateCcw size={32} style={{ marginBottom: '0.5rem' }} />
              <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Update JMS</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem' }}>Sinkron status terkini</span>
            </button>

            {/* Sync Retur Button */}
            <button 
              className="btn"
              style={{ 
                height: '140px', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                background: (!mergeStatus.ongoing && uploadedFiles.retur) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                color: (!mergeStatus.ongoing && uploadedFiles.retur) ? 'var(--warning)' : 'var(--text-muted)',
                border: (!mergeStatus.ongoing && uploadedFiles.retur) ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--glass-border)'
              }}
              onClick={handleUpdateRetur} 
              disabled={mergeStatus.ongoing || !uploadedFiles.retur}
            >
              <Database size={32} style={{ marginBottom: '0.5rem' }} />
              <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sync Retur</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.25rem' }}>Buka blokir waybill retur</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card glass" style={{ marginBottom: 0, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'linear-gradient(to bottom, var(--glass-bg), rgba(239, 68, 68, 0.05))', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
             <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '1rem', color: 'var(--danger)' }}>
                <Lock size={18} />
                Danger Zone
             </h2>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '1.5rem' }}>
             <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Zona ini dibatasi khusus **Regional Manager**. Purge DB akan menghapus <strong style={{ color: 'var(--danger)' }}>seluruh data</strong>.
             </p>
             <button 
                className="btn"
                style={{ width: '100%', justifyContent: 'center', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.5)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em' }}
                onClick={handleResetDatabase}
             >
                <AlertCircle size={16} />
                Purge Database
             </button>
          </div>
        </div>
      </div>
      
    </div>
  );
};
