import React, { useState, useEffect, useRef } from 'react';
import { RefreshCcw, AlertCircle, TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { fetchDailyProgress, fetchMonitoringMonths } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const DailyProgressReport = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const monthsRes = await fetchMonitoringMonths();
      if (monthsRes.success && monthsRes.months && monthsRes.months.length > 0) {
        setAvailableMonths(monthsRes.months);
        setSelectedMonth(monthsRes.months[0]); // Default to current/latest month
      }
      await loadData();
    } catch (e) {
      toast.error('Gagal memuat daftar bulan');
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchDailyProgress();
      if (res.success) {
        let filteredRes = res.data || [];
        if (user && user.role !== 'RM' && user.dp_access && user.dp_access !== '*') {
          const allowed = user.dp_access.split(',').map(d => d.trim().toLowerCase());
          filteredRes = filteredRes.filter(row => allowed.includes((row.drop_point || '').toLowerCase()));
        }
        setData(filteredRes);
        toast.success(`Berhasil memuat laporan progress harian`);
      }
    } catch (error) {
      toast.error('Gagal memuat data Daily Progress');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportImage = async () => {
    if (!exportRef.current) return;
    
    setIsExporting(true);
    const toastId = toast.loading('Memproses gambar resolusi tinggi...');
    
    try {
      // Cleanest way to handle overflow: add a CSS class with !important rules
      exportRef.current.classList.add('export-mode');

      // Wait for React to apply classes and browser to recalc layout
      await new Promise(r => setTimeout(r, 200));
      
      const dataUrl = await toPng(exportRef.current, {
        backgroundColor: '#0f172a',
        style: {
          borderRadius: '0',
          margin: '0',
          padding: '2rem',
          height: 'auto',
          width: 'max-content',
          minWidth: '100%',
        },
        pixelRatio: 3,
        cacheBust: true,
      });

      // Remove the export mode class
      exportRef.current.classList.remove('export-mode');
      
      const link = document.createElement('a');
      link.download = `Progress_Harian_${selectedMonth}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Gambar berhasil diunduh siap dibagikan!', { id: toastId });
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal mengekspor gambar', { id: toastId });
      if (exportRef.current) exportRef.current.classList.remove('export-mode');
    } finally {
      setIsExporting(false);
    }
  };

  // Group data by Bulan
  const groupedData = data.reduce((acc, row) => {
    if (!acc[row.bulan]) {
      acc[row.bulan] = [];
    }
    acc[row.bulan].push(row);
    return acc;
  }, {});

  // Sort each month's data by progress percentage (highest first)
  Object.keys(groupedData).forEach(bulan => {
    groupedData[bulan].sort((a, b) => b.progress_percent - a.progress_percent);
  });

  const getProgressColor = (percent) => {
    if (percent === 0) return 'var(--danger)'; // 0%: Dark Red Mencekam
    if (percent < 50) return 'var(--warning)'; // <50%: Orange
    if (percent <= 80) return '#3b82f6'; // 50-80%: Blue On-track
    return 'var(--success)'; // >80%: Emerald / Juara
  };

  const getProgressIcon = (percent) => {
    if (percent === 0) return <Minus size={16} key="zero" />;
    if (percent < 50) return <TrendingDown size={16} key="down" />;
    return <TrendingUp size={16} key="up" />;
  };

  const monthNames = {
    '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
    '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
    '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember'
  };

  const formatBulan = (bulanStr) => {
    if (!bulanStr) return 'Unknown';
    const parts = bulanStr.split('-');
    if (parts.length === 2) {
      const b_name = monthNames[parts[1]] || parts[1];
      return `${b_name} ${parts[0]}`;
    }
    return bulanStr;
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card glass">
        <div className="card-header">
          <div>
            <h2 className="card-title">Laporan Progress Harian</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Monitoring kecepatan eksekusi retur & TTD hari ini berbasis total sisa target aktif.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="search-input"
              style={{ width: 'auto', minWidth: '150px' }}
            >
              {availableMonths.map(m => <option key={m} value={m}>{formatBulan(m)} ({m})</option>)}
            </select>
            <button className="btn btn-secondary" onClick={handleExportImage} disabled={loading || isExporting || !selectedMonth}>
              <Download size={18} className={isExporting ? "loading-spinner" : ""} />
              Download JPG
            </button>
            <button className="btn btn-primary" onClick={loadData} disabled={loading || isExporting}>
              <RefreshCcw size={18} className={loading && !isExporting ? "loading-spinner" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div ref={exportRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="card glass" style={{ padding: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Cara Membaca Warna Performa (Hari Ini)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--success)' }}></div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.875rem' }}>Emas / Hijau Emerald (&gt;80%)</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kinerja Luar Biasa (Juara)</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#3b82f6' }}></div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.875rem' }}>Biru Cerah (50% - 80%)</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Standar / On-track</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', borderRadius: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--warning)' }}></div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.875rem' }}>Kuning / Jingga (&lt;50%)</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Waspada / Kinerja Rendah</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--danger)' }}></div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.875rem' }}>Merah (0%)</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tidak Ada Progress Sama Sekali!</span>
            </div>
          </div>
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="card glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCcw size={48} className="loading-spinner" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
          <p>Menganalisa kinerja harian tiap Drop Point...</p>
        </div>
      ) : !groupedData[selectedMonth] || groupedData[selectedMonth].length === 0 ? (
        <div className="card glass" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <AlertCircle size={48} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
          <p>Tidak ada data target progress untuk bulan <strong>{formatBulan(selectedMonth)}</strong>.</p>
        </div>
      ) : (
        <div className="card glass" style={{ overflow: 'hidden' }}>
          <div className="card-header" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Target Bulan: {formatBulan(selectedMonth)}</h3>
          </div>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Peringkat</th>
                  <th>Drop Point</th>
                  <th style={{ textAlign: 'center' }}>Total Sisa Target</th>
                  <th style={{ textAlign: 'center', color: 'var(--warning)' }}>Regis Retur Hari Ini</th>
                  <th style={{ textAlign: 'center', color: 'var(--success)' }}>Scan TTD Hari Ini</th>
                  <th style={{ textAlign: 'center' }}>Total Ditangani Ini Hari</th>
                  <th style={{ textAlign: 'center' }}>Progress (%)</th>
                </tr>
              </thead>
              <tbody>
                {groupedData[selectedMonth].map((row, idx) => {
                    const totalDitangani = row.regis_retur_hari_ini + row.ttd_hari_ini;
                    const cColor = getProgressColor(row.progress_percent);
                    
                    return (
                      <tr key={idx} style={{ 
                        background: idx === 0 && row.progress_percent > 0 ? 'rgba(16, 185, 129, 0.05)' : '' // Highlight Juara 1 slightly
                      }}>
                        <td style={{ textAlign: 'center', width: '60px' }}>
                          {idx === 0 && row.progress_percent > 0 ? (
                            <span style={{ fontSize: '1.5rem' }}>🥇</span>
                          ) : idx === 1 && row.progress_percent > 0 ? (
                            <span style={{ fontSize: '1.5rem' }}>🥈</span>
                          ) : idx === 2 && row.progress_percent > 0 ? (
                            <span style={{ fontSize: '1.5rem' }}>🥉</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          )}
                        </td>
                        <td><strong style={{ fontSize: '1.1rem' }}>{row.drop_point}</strong></td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.total_target}</td>
                        <td style={{ textAlign: 'center' }}>{row.regis_retur_hari_ini}</td>
                        <td style={{ textAlign: 'center' }}>{row.ttd_hari_ini}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-main)' }}>{totalDitangani}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', fontWeight: 'bold', fontSize: '1.1rem', color: cColor }}>
                            {getProgressIcon(row.progress_percent)}
                            {row.progress_percent}%
                          </div>
                          {/* Progress Bar Visual */}
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${row.progress_percent}%`, 
                              height: '100%', 
                              background: cColor,
                              transition: 'width 1s ease-in-out'
                            }}></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
