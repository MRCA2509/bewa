import React, { useState, useEffect } from 'react';
import { RefreshCcw, AlertCircle } from 'lucide-react';
import { fetchDatabase } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const HistoryShipments = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [reportDates, setReportDates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchDatabase();
      if (res.success) {
        let filteredHistory = res.data.history || [];
        if (user && user.role !== 'RM' && user.dp_access && user.dp_access !== '*') {
          const allowed = user.dp_access.split(',').map(d => d.trim().toLowerCase());
          filteredHistory = filteredHistory.filter(row => allowed.includes((row.drop_point || '').toLowerCase()));
        }
        
        setData(filteredHistory);
        
        // Extract dates for heatmap
        if (filteredHistory.length > 0) {
          const allDates = filteredHistory
            .map(row => row.waktu_sampai?.slice(0, 10))
            .filter(d => d)
            .sort()
            .slice(-7); // Last 7 days
          setReportDates([...new Set(allDates)]);
        }
        toast.success(`Berhasil memuat ${filteredHistory.length || 0} history records`);
      }
    } catch (error) {
      toast.error('Gagal memuat data History Shipments');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Get cell class based on value
  const getCellClass = (val) => {
    if (!val || val === 0) return 'cell-val-0';
    if (val < 50) return 'cell-val-low';
    if (val < 200) return 'cell-val-mid';
    return 'cell-val-high';
  };

  // Handle cell click in heatmap
  const handleCellClick = (dropPoint, date, count) => {
    if (count === 0) return;
    const filtered = data.filter(row => {
      const rowDate = row.waktu_sampai?.slice(0, 10);
      return row.drop_point === dropPoint && rowDate === date;
    });
    
    // Convert to a neat alert or custom toast. For simplicity, native alert replaced with a modal later if needed,
    // but a detailed toast or native alert works.
    const message = `Drop Point: ${dropPoint}\nDate: ${date}\nCount: ${count}\n\nFirst ${Math.min(5, filtered.length)} waybills:\n${filtered.slice(0, 5).map(r => r.waybill_id).join('\n')}`;
    window.alert(message); // Keep window.alert for quick history heatmap or use modal
  };

  // Group data by Drop Point
  const grouped = data.reduce((acc, row) => {
    const dp = row.drop_point || 'Unknown';
    if (!acc[dp]) acc[dp] = { total: 0, dates: {} };
    const date = row.waktu_sampai?.slice(0, 10);
    if (date) {
      acc[dp].dates[date] = (acc[dp].dates[date] || 0) + 1;
      acc[dp].total++;
    }
    return acc;
  }, {});

  return (
    <div className="card glass animate-in">
      <div className="card-header">
        <h2 className="card-title">Heatmap Report - Drop Point Performance (Last 7 Days)</h2>
        <button className="btn btn-primary" onClick={loadData} disabled={loading}>
          <RefreshCcw size={18} className={loading ? "loading-spinner" : ""} />
          Refresh
        </button>
      </div>

      <div style={{ marginBottom: '1rem', fontSize: '0.75rem', display: 'flex', gap: '1rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: 10, height: 10, background: 'rgba(16, 185, 129, 0.4)' }}></div>
          Good (0-50)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: 10, height: 10, background: 'rgba(245, 158, 11, 0.4)' }}></div>
          Warning (50-200)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: 10, height: 10, background: 'rgba(239, 68, 68, 0.4)' }}></div>
          Bad (&gt;200)
        </span>
      </div>

      <div className="data-table-container">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Drop Point</th>
              {reportDates.map(d => (
                <th key={d} style={{ textAlign: 'center' }}>{d.slice(5).replace('-', '/')}</th>
              ))}
              <th style={{ background: '#334155', color: '#fff' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={reportDates.length + 2} style={{ textAlign: 'center', padding: '2rem' }}>Memuat data heatmap...</td></tr>
            ) : Object.keys(grouped).length > 0 ? (
              Object.entries(grouped).map(([dp, dpData]) => (
                <tr key={dp}>
                  <td style={{ textAlign: 'left', fontWeight: 500 }}>{dp}</td>
                  {reportDates.map(d => (
                    <td
                      key={d}
                      className={`interactive-cell ${getCellClass(dpData.dates[d])}`}
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => handleCellClick(dp, d, dpData.dates[d])}
                      title={`Click to see details for ${dp} on ${d}`}
                    >
                      {dpData.dates[d] || 0}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', background: '#1e293b', fontWeight: 'bold' }}>
                    {dpData.total}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={reportDates.length + 2} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>Tidak ada data history untuk ditampilkan dalam heatmap.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
