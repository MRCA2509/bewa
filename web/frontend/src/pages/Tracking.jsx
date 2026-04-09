import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, ShieldAlert, MessageSquare, Clock, Send, User, Edit2, Trash2, X, Check, UploadCloud } from 'lucide-react';
import { trackWaybill, manualEndStatus, fetchWaybillFeedbacks, addWaybillFeedback, updateWaybillFeedback, deleteWaybillFeedback, uploadBulkFeedback } from '../services/api';
import { formatDateTime } from '../utils/formatters';
import toast from 'react-hot-toast';

export const Tracking = ({ initialWaybill, isPopup = false, onClose }) => {
  const [searchWaybill, setSearchWaybill] = useState(initialWaybill || '');
  const [trackingResult, setTrackingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Feedback states
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [newFeedbackPIC, setNewFeedbackPIC] = useState('');
  const [newFeedbackText, setNewFeedbackText] = useState('');
  const [submitFeedbackLoading, setSubmitFeedbackLoading] = useState(false);
  
  // Edit & Delete states
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [editFeedbackText, setEditFeedbackText] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Manual action states
  const [manualJenisScan, setManualJenisScan] = useState('');
  const [voidFeedback, setVoidFeedback] = useState('');
  const [voiding, setVoiding] = useState(false);

  // Bulk Upload state
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false);

  useEffect(() => {
    if (initialWaybill) {
      setSearchWaybill(initialWaybill);
      handleLookup(initialWaybill);
    }
  }, [initialWaybill]);

  const loadFeedbacks = async (waybillId) => {
    setFeedbacksLoading(true);
    try {
      const res = await fetchWaybillFeedbacks(waybillId);
      if (res.success) {
         setFeedbacks(res.data);
      }
    } catch (e) {
      console.error("Error memuat feedback", e);
    } finally {
      setFeedbacksLoading(false);
    }
  };

  const handleLookup = async (overrideWaybill) => {
    const query = typeof overrideWaybill === 'string' ? overrideWaybill : searchWaybill;
    if (!query.trim()) {
      toast.error('Masukkan nomor waybill');
      return;
    }
    setLoading(true);
    setManualJenisScan('');
    setVoidFeedback('');
    setFeedbacks([]);
    setEditingFeedbackId(null);
    
    try {
      const res = await trackWaybill(query);
      if (res.success && res.data) {
        setTrackingResult(res);
        await loadFeedbacks(res.data.waybill_id);
      } else {
        setTrackingResult({ error: res.message || 'Waybill tidak ditemukan' });
      }
    } catch (e) {
      setTrackingResult({ error: 'Terjadi kesalahan sistem' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualVoid = async () => {
    if (!trackingResult || !trackingResult.data) return;
    if (!manualJenisScan) {
      toast.error('Pilih Jenis Scan terlebih dahulu');
      return;
    }

    if (!window.confirm(`APAKAH ANDA YAKIN?\n\nResi ${trackingResult.data.waybill_id} akan di-VOID dan dipindah ke Histori secara permanen.`)) {
      return;
    }

    setVoiding(true);
    try {
      const res = await manualEndStatus(trackingResult.data.waybill_id, manualJenisScan, voidFeedback);
      if (res.success) {
         try {
           await addWaybillFeedback(trackingResult.data.waybill_id, "SYSTEM / VOID", `VOID MANUAL: ${manualJenisScan}. ${voidFeedback ? `Note: ${voidFeedback}` : ''}`);
         } catch(e) {}
         
         toast.success(res.message);
         handleLookup(trackingResult.data.waybill_id);
      } else {
        toast.error(res.message || 'Gagal melakukan VOID manual');
      }
    } catch (error) {
      toast.error(error.message || 'Terjadi kesalahan saat memproses VOID');
    } finally {
      setVoiding(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!trackingResult || !trackingResult.data) return;
    if (!newFeedbackPIC.trim() || !newFeedbackText.trim()) {
      toast.error('Nama PIC dan Pesan Wajib Diisi!');
      return;
    }

    setSubmitFeedbackLoading(true);
    try {
      const res = await addWaybillFeedback(trackingResult.data.waybill_id, newFeedbackPIC, newFeedbackText);
      if (res.success) {
        toast.success(res.message);
        setNewFeedbackText('');
        await loadFeedbacks(trackingResult.data.waybill_id);
      } else {
         toast.error(res.message || 'Gagal menambahkan feedback');
      }
    } catch (e) {
      toast.error(e.message || 'Terjadi kesalahan');
    } finally {
      setSubmitFeedbackLoading(false);
    }
  };

  const startEditFeedback = (feedback) => {
    setEditingFeedbackId(feedback.id);
    setEditFeedbackText(feedback.feedback_text);
  };

  const cancelEdit = () => {
    setEditingFeedbackId(null);
    setEditFeedbackText('');
  };

  const handleSaveEdit = async (feedbackId) => {
    if (!editFeedbackText.trim()) {
      toast.error('Pesan tidak boleh kosong!');
      return;
    }
    setActionLoadingId(feedbackId);
    try {
      const res = await updateWaybillFeedback(feedbackId, editFeedbackText);
      if (res.success) {
        toast.success('Feedback diperbarui');
        setEditingFeedbackId(null);
        await loadFeedbacks(trackingResult.data.waybill_id);
      } else {
        toast.error(res.message || 'Gagal update feedback');
      }
    } catch (e) {
      toast.error(e.message || 'Terjadi kesalahan');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    if (!window.confirm('Hapus catatan ini secara permanen?')) return;
    setActionLoadingId(feedbackId);
    try {
      const res = await deleteWaybillFeedback(feedbackId);
      if (res.success) {
        toast.success('Feedback dihapus');
        await loadFeedbacks(trackingResult.data.waybill_id);
      } else {
        toast.error(res.message || 'Gagal hapus feedback');
      }
    } catch (e) {
      toast.error(e.message || 'Terjadi kesalahan');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMassalUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setBulkUploadLoading(true);
    const toastId = toast.loading('Mengupload dan memproses feedback masal...');
    try {
      const res = await uploadBulkFeedback(file);
      if (res.success) {
        toast.success(res.message, { id: toastId });
        if (trackingResult && trackingResult.data) {
           await loadFeedbacks(trackingResult.data.waybill_id);
        }
      } else {
        toast.error(res.message || 'Gagal upload masal', { id: toastId });
      }
    } catch (error) {
      toast.error(error.message || 'Terjadi kesalahan saat upload file', { id: toastId });
    } finally {
      setBulkUploadLoading(false);
      event.target.value = ''; // reset input
    }
  };

  // Rendering the chat UI to be reused in both Native/Popup views
  const renderFeedbackTimeline = (mode) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingLeft: mode === 'popup' ? '2rem' : '0', borderLeft: mode === 'popup' ? '1px solid var(--glass-border)' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <MessageSquare size={18} />
          Log Obrolan & Catatan Harian
        </h3>
      </div>

      {/* Tampilan seperti Chat Window */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        background: 'rgba(0,0,0,0.15)', 
        borderRadius: '1rem', 
        padding: '1.5rem',
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column-reverse', // Obrolan terbaru di paling bawah
        marginBottom: '1.5rem'
      }}>
        {feedbacksLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Memuat pesan...</div>
        ) : feedbacks.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontStyle: 'italic', margin: 'auto' }}>
            Percakapan kosong. Mulai lapor kendala paket ini.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '1rem' }}>
            {feedbacks.map((f) => {
              const isSystem = f.reported_by === 'SYSTEM / VOID';
              const isCurrentUser = f.reported_by.toLowerCase().includes('dp'); // Contoh asumsi, bisa dikembangkan

              // Styling chat web-whatsapp look
              const bubbleBg = isSystem ? 'rgba(239, 68, 68, 0.1)' : 
                               isCurrentUser ? '#005c4b' : 'var(--glass)';
              
              const alignSelf = isSystem ? 'center' : 'flex-start';
              const tailBorder = isCurrentUser ? 
                { borderBottomRightRadius: '0px' } : 
                { borderBottomLeftRadius: '0px' };

              return (
                <div key={f.id} style={{ display: 'flex', flexDirection: 'column', alignSelf, maxWidth: isSystem ? '90%' : '85%' }}>
                  <div style={{ paddingLeft: '0.5rem', marginBottom: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                     <span style={{ fontWeight: 600, color: isSystem ? 'var(--danger)' : 'var(--primary)' }}>{f.reported_by}</span>
                  </div>
                  
                  <div style={{ 
                    position: 'relative',
                    background: bubbleBg, 
                    padding: '0.75rem 1rem', 
                    borderRadius: '1rem', 
                    ...(!isSystem ? tailBorder : {}),
                    border: isSystem ? '1px solid rgba(239,68,68,0.2)' : 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {editingFeedbackId === f.id ? (
                      <div style={{ marginTop: '0.5rem' }}>
                        <textarea
                          className="search-input"
                          style={{ width: '100%', minHeight: '60px', padding: '0.5rem', fontSize: '0.9rem', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '0.5rem' }}
                          value={editFeedbackText}
                          onChange={(e) => setEditFeedbackText(e.target.value)}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={cancelEdit} className="btn" style={{ padding: '0.25rem', background: 'transparent' }}><X size={14} color="#aaa" /></button>
                          <button onClick={() => handleSaveEdit(f.id)} className="btn" style={{ padding: '0.25rem', background: 'var(--primary)' }}>
                            {actionLoadingId === f.id ? <span className="loading-spinner" style={{width:14, height:14}}></span> : <Check size={14} color="#fff" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {f.feedback_text}
                      </p>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '0.25rem', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>
                        {formatDateTime(f.created_at)}
                      </span>
                      {!isSystem && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => startEditFeedback(f)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} title="Edit"><Edit2 size={12} color="rgba(255,255,255,0.4)" /></button>
                          <button onClick={() => handleDeleteFeedback(f.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} title="Hapus">
                            {actionLoadingId === f.id ? <span className="loading-spinner" style={{width: 12, height: 12, borderTopColor:'var(--danger)'}}></span> : <Trash2 size={12} color="rgba(255,255,255,0.4)" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Area Mengetik Chat */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '1rem', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <User size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Nama Anda (misal: Sinta - DP Buli)" 
                style={{ width: '100%', paddingLeft: '2rem', height: '32px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: 'none' }}
                value={newFeedbackPIC}
                onChange={(e)=>setNewFeedbackPIC(e.target.value)}
              />
            </div>
            <textarea 
               className="search-input" 
               placeholder="Ketik laporan atau catatan kendala..."
               style={{ width: '100%', height: '50px', padding: '0.5rem 1rem', resize: 'none', background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff' }}
               value={newFeedbackText}
               onChange={(e)=>setNewFeedbackText(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '48px', height: '48px', borderRadius: '50%', padding: '0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            onClick={handleSubmitFeedback}
            disabled={submitFeedbackLoading}
          >
            {submitFeedbackLoading ? <span className="loading-spinner"></span> : <Send size={20} style={{ marginLeft: '-2px' }} />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`card glass animate-in ${isPopup ? 'popup-tracking' : ''}`} style={isPopup ? { width: '100%', height: '100%', overflowY: 'auto' } : {}}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="card-title">Track Waybill</h2>
          {isPopup ? 
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Melihat detail resi dan histori operasional</p> :
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Melihat histori laporan dan chat operasional resi</p>
          }
        </div>
        {isPopup && (
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'var(--danger-gradient)', color: '#fff', border: 'none' }}>
            <X size={18} style={{ marginRight: '0.5rem' }} /> Tutup Panel
          </button>
        )}
      </div>
      
      {!isPopup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <div className="search-container" style={{ flex: 1, maxWidth: '600px', margin: 0 }}>
            <input
              type="text"
              className="search-input"
              placeholder="Ketik & cari waybill untuk melihat percakapan..."
              value={searchWaybill}
              onChange={(e) => setSearchWaybill(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLookup()}
              disabled={loading}
              style={{ borderRadius: '2rem' }}
            />
            <button className="btn btn-primary" onClick={() => handleLookup()} disabled={loading} style={{ borderRadius: '2rem' }}>
              <Search size={18} className={loading ? "loading-spinner" : ""} />
              {loading ? 'Mencari...' : 'Cari Resi'}
            </button>
          </div>
          
          <div>
            <input 
              type="file" 
              id="upload-massal-feedback-main" 
              style={{ display: 'none' }}
              accept=".xlsx,.xls,.csv"
              onChange={handleMassalUpload}
            />
            <button 
              className="btn shadow-hover"
              style={{ borderRadius: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1rem' }}
              onClick={() => document.getElementById('upload-massal-feedback-main').click()}
              disabled={bulkUploadLoading}
              title="Upload format Excel: Nomor Waybill | Feedback"
            >
              {bulkUploadLoading ? <Clock size={16} className="loading-spinner" /> : <UploadCloud size={16} color="#ffffff" />}
              Upload Feedback Massal
            </button>
          </div>
        </div>
      )}

      {loading && isPopup && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--primary)' }}>
          <span className="loading-spinner" style={{ width: '3rem', height: '3rem', display: 'inline-block' }}></span>
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Memuat data resi...</p>
        </div>
      )}

      {trackingResult && !loading && (
        <div className="animate-in" style={{ padding: isPopup ? '1.5rem' : '0' }}>
          {trackingResult.error ? (
            <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)', padding: '1rem', borderRadius: '0.5rem' }}>
              <AlertCircle size={20} />
              {trackingResult.error}
            </div>
          ) : (
            <>
              {/* JIKA BUKAN POPUP (Menu Native), TAMPILKAN INFO RINGKAS + CHAT */}
              {!isPopup ? (
                 <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                   
                   {/* INFO RINGKAS RESI (Native Only) */}
                   <div className="glass" style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--glass-border)', background: 'var(--premium-glass)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <div className={`status-dot ${trackingResult.location === 'active' ? 'status-active' : 'status-history'}`}></div>
                         <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{trackingResult.data.waybill_id}</h2>
                       </div>
                       <span className="badge badge-blue">{trackingResult.data.jenis_scan || 'STATUS N/A'}</span>
                     </div>
                     
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
                        <div>
                          <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Tujuan</label>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{trackingResult.data.tujuan || '-'}</div>
                        </div>
                        <div>
                          <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Station</label>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{trackingResult.data.station_scan || '-'}</div>
                        </div>
                        <div>
                          <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Sampai DP</label>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{formatDateTime(trackingResult.data.waktu_sampai)}</div>
                        </div>
                        <div>
                          <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Umur Paket</label>
                          <div style={{ color: 'var(--primary)', fontWeight: 800 }}>{trackingResult.data.waktu_sampai ? `${Math.floor((new Date() - new Date(trackingResult.data.waktu_sampai)) / (1000 * 60 * 60 * 24))} Hari` : '-'}</div>
                        </div>
                        <div>
                          <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Regis Retur</label>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{formatDateTime(trackingResult.data.waktu_regis_retur)}</div>
                        </div>
                        <div>
                          <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Konfirmasi Retur</label>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{formatDateTime(trackingResult.data.waktu_konfirmasi_retur)}</div>
                        </div>
                     </div>
                   </div>

                   {/* LOG FEEDBACK / CHAT */}
                   {renderFeedbackTimeline('native')}

                   <div style={{ textAlign: 'center', opacity: 0.5 }}>
                     <p style={{ fontSize: '0.8rem' }}>Fitur pengelolaan VOID Manual dipindahkan ke menu <b>Control Tower</b>.</p>
                   </div>
                 </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '2rem', alignItems: 'start' }}>
                  
                  {/* Kolom Kiri: Detail & VOID (Khusus Pop-up) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                         <div className={`status-dot ${trackingResult.location === 'active' ? 'status-active' : 'status-history'}`}></div>
                         <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>RESI: {trackingResult.data.waybill_id}</span>
                      </div>
                      <span className={`badge ${trackingResult.location === 'active' ? 'badge-blue' : 'badge-green'}`}>
                        {trackingResult.location === 'active' ? 'DATA AKTIF' : 'DATA HISTORI'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '1rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Tujuan</span>
                        <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{trackingResult.data.tujuan}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Status Scan</span>
                        <div style={{ marginTop: '0.25rem' }}>
                          <span className="badge badge-green">{trackingResult.data.jenis_scan || 'N/A'}</span>
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Station Terakhir</span>
                        <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{trackingResult.data.station_scan || 'N/A'}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Waktu Sampai</span>
                        <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{formatDateTime(trackingResult.data.waktu_sampai)}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Waktu Scan Terakhir</span>
                        <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{formatDateTime(trackingResult.data.waktu_scan)}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Alasan Masalah</span>
                        <div style={{ fontWeight: 600, marginTop: '0.25rem', color: trackingResult.data.alasan_masalah?.includes('VOID') ? 'var(--danger)' : 'inherit' }}>
                          {trackingResult.data.alasan_masalah || '-'}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Waktu Regis Retur</span>
                        <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{formatDateTime(trackingResult.data.waktu_regis_retur)}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Waktu Konfirmasi Retur</span>
                        <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{formatDateTime(trackingResult.data.waktu_konfirmasi_retur)}</div>
                      </div>
                    </div>

                    {/* MANUAL ACTION SECTION */}
                    {trackingResult.location === 'active' && (
                      <div style={{ marginTop: '1rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--danger)', fontSize: '1.1rem' }}>
                          <ShieldAlert size={20} />
                          Aksi Pengguna (Manual End Status)
                        </h3>
                        <div className="glass" style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>
                            Gunakan fitur ini untuk <strong>menghentikan pemantauan</strong> nomor resi secara manual (dipindah ke histori: "VOID").
                          </p>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Jenis Scan Hasil Akhir</label>
                              <select 
                                className="search-input" 
                                style={{ width: '100%', height: '40px', padding: '0 0.75rem' }}
                                value={manualJenisScan}
                                onChange={(e) => setManualJenisScan(e.target.value)}
                              >
                                <option value="">-- Pilih Jenis Scan --</option>
                                <option value="Scan TTD">Scan TTD (Selesai Kirim)</option>
                                <option value="Scan Kirim">Scan Kirim (Lanjut Transit)</option>
                                <option value="Scan TTD Retur">Scan TTD Retur (Selesai Kembali)</option>
                                <option value="Scan Bermasalah">Scan Bermasalah (Void)</option>
                              </select>
                            </div>
                            
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Keterangan Void</label>
                              <textarea
                                className="search-input"
                                style={{ width: '100%', height: '60px', padding: '0.5rem', resize: 'none' }}
                                placeholder="Opsional..."
                                value={voidFeedback}
                                onChange={(e) => setVoidFeedback(e.target.value)}
                              />
                            </div>
                            
                            <button 
                              className="btn btn-primary" 
                              style={{ background: 'var(--danger-gradient)', borderColor: 'transparent', height: '40px', fontWeight: 600, marginTop: '0.5rem' }}
                              onClick={handleManualVoid}
                              disabled={voiding || !manualJenisScan}
                            >
                              {voiding ? 'Memproses...' : 'Konfirmasi VOID Manual'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Kolom Kanan: Feedback Timeline di Popup */}
                  {renderFeedbackTimeline('popup')}

                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
