import React, { useState, useEffect } from 'react';
import { RefreshCcw, X, AlertCircle, Download } from 'lucide-react';
import { fetchAllDatabase, fetchMonitoringMonths } from '../services/api';
import { processMonitoringData, getCellClass, getLocalDate, isRecentHandling } from '../utils/monitoring';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { useRef } from 'react';
import { Tracking } from './Tracking';
import { useAuth } from '../context/AuthContext';

export const MonitoringReport = () => {
  const { user } = useAuth();
  const [databaseData, setDatabaseData] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [monitoringData, setMonitoringData] = useState(null);
  const [expandedDPs, setExpandedDPs] = useState({});
  const [trackingModalData, setTrackingModalData] = useState(null);
  const [activeTrackingWaybill, setActiveTrackingWaybill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const tableRef = useRef(null);

  const ALL_DROP_POINTS = ['MABA', 'BULI', 'WASILE', 'SOFIFI', 'LABUHA', 'FALAJAWA2', 'SANANA', 'BOBONG'];
  const ACTIVE_DROP_POINTS = user?.role !== 'RM' && user?.dp_access && user.dp_access !== '*'
    ? ALL_DROP_POINTS.filter(dp => user.dp_access.toLowerCase().includes(dp.toLowerCase()))
    : ALL_DROP_POINTS;

  useEffect(() => {
    loadMonthsAndData();
  }, []);

  const loadMonthsAndData = async () => {
    setLoading(true);
    try {
      const monthsRes = await fetchMonitoringMonths();
      let defaultMonth = '';
      if (monthsRes.success && monthsRes.months && monthsRes.months.length > 0) {
        setAvailableMonths(monthsRes.months);
        defaultMonth = monthsRes.months[0];
        setSelectedMonth(defaultMonth);
      } else {
        const fallback = new Date().toISOString().slice(0, 7);
        setAvailableMonths([fallback]);
        setSelectedMonth(fallback);
        defaultMonth = fallback;
      }

      await loadDatabase(defaultMonth);
    } catch (e) {
      toast.error('Gagal memuat bulan monitoring');
      setLoading(false);
    }
  };

  const loadDatabase = async (month) => {
    setLoading(true);
    try {
      // Use fetchAllDatabase for legacy monitor grouping. Warning: slow on 100k+ rows
      const res = await fetchAllDatabase();
      if (res.success) {
        setDatabaseData(res.data);
        if (month) {
          setMonitoringData(processMonitoringData(res.data.active, month));
        }
        toast.success('Data Monitoring berhasil diperbarui');
      }
    } catch (e) {
      toast.error('Gagal memuat data database');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (e) => {
    const month = e.target.value;
    setSelectedMonth(month);
    if (databaseData?.active) {
      setMonitoringData(processMonitoringData(databaseData.active, month));
    }
  };

  const handleMonitoringCellClick = (dropPoint, category, date, count) => {
    if (!count || count === 0) return;
    const filtered = (databaseData?.active || []).filter(row => {
      if (row.drop_point !== dropPoint) return false;
      
      const fullDate = getLocalDate(row.waktu_sampai);
      if (fullDate !== date) return false;

      // SLA Filtering (Must match processMonitoringData exactly)
      const regisReturStr = row.waktu_regis_retur;
      const isHandlingRecent = isRecentHandling(regisReturStr);
      const isScanKirimRecent = row.jenis_scan === 'Scan Kirim' && isRecentHandling(row.waktu_scan);
      if (isHandlingRecent || isScanKirimRecent) return false;

      // Category match
      if (category) {
        let rowCategory = 'Indikasi';
        const hasRegisRetur = regisReturStr && !regisReturStr.includes('0001') && regisReturStr !== 'null' && regisReturStr !== '';
        
        if (hasRegisRetur) {
          rowCategory = 'Regis Retur';
        } else if (row.jenis_scan) {
          rowCategory = row.jenis_scan;
        }
        
        return rowCategory === category;
      }
      return true; 
    });

    setTrackingModalData({
      dropPoint,
      category: category || 'Semua Kategori',
      date,
      total: count,
      waybills: filtered.map(r => r.waybill_id)
    });
  };

  if (loading && !monitoringData) {
    return (
      <div className="card glass animate-in">
        <div className="card-header"><h2 className="card-title">Daily Monitoring Report</h2></div>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCcw size={48} className="loading-spinner" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <p>Memuat data monitoring...</p>
        </div>
      </div>
    );
  }

  // Calculate Dates and Footers
  const allDates = new Set();
  if (monitoringData) {
    Object.keys(monitoringData).forEach(dp => {
      Object.keys(monitoringData[dp]).forEach(cat => {
        Object.keys(monitoringData[dp][cat]).forEach(key => {
          if (key !== 'total' && key.match(/^\d{4}-\d{2}-\d{2}$/)) allDates.add(key);
        });
      });
    });
  }
  const sortedDates = Array.from(allDates).sort();

  const dateTotals = {};
  sortedDates.forEach(d => {
    dateTotals[d] = 0;
    ACTIVE_DROP_POINTS.forEach(dp => {
      if (monitoringData && monitoringData[dp]) {
        Object.keys(monitoringData[dp]).forEach(cat => {
          dateTotals[d] += (monitoringData[dp][cat][d] || 0);
        });
      }
    });
  });
  const grandTotal = Object.values(dateTotals).reduce((a, b) => a + b, 0);

  const handleExportExcel = () => {
    if (!monitoringData) return;
    
    // Build rows Array of Arrays (AoA) for Excel export
    const headers = ['Drop Point / Category', ...sortedDates.map(d => d.slice(8)), 'TOTAL'];
    const rows = [headers];

    ACTIVE_DROP_POINTS.forEach((dp) => {
      const dpData = monitoringData[dp] || {};
      const categoryNames = Object.keys(dpData).filter(name => name !== 'total');
      const dpTotal = categoryNames.reduce((sum, catName) => sum + (dpData[catName]?.total || 0), 0);
      const dpDateTotal = (d) => categoryNames.reduce((sum, catName) => sum + (dpData[catName]?.[d] || 0), 0);
      
      // DP Main Row
      const dpRow = [dp];
      sortedDates.forEach(d => dpRow.push(dpDateTotal(d)));
      dpRow.push(dpTotal);
      rows.push(dpRow);

      // Category Details Rows
      categoryNames.sort((a, b) => { // Match UI sorting
        if (a === 'Regis Retur') return 1;
        if (b === 'Regis Retur') return -1;
        return a.localeCompare(b);
      }).forEach(catName => {
        const data = dpData[catName] || {};
        const catRow = [`  ${catName}`]; // Indent category
        sortedDates.forEach(d => catRow.push(data[d] || 0));
        catRow.push(data.total || 0);
        rows.push(catRow);
      });
    });

    // Grand Total Row
    const footerRow = ['GRAND TOTAL'];
    sortedDates.forEach(d => footerRow.push(dateTotals[d] || 0));
    footerRow.push(grandTotal);
    rows.push(footerRow);

    // Build and save Excel file
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Report_${selectedMonth}`);
    XLSX.writeFile(wb, `Daily_Monitoring_Report_${selectedMonth}.xlsx`);
    toast.success('Laporan berhasil diunduh sebagai Excel!');
  };

  const handleExportImage = async () => {
    if (!tableRef.current) return;
    
    // 1. Enter Export Mode
    setIsExporting(true);
    const prevExpanded = { ...expandedDPs };
    
    // Expand all DPs for the report
    const allExpanded = {};
    ACTIVE_DROP_POINTS.forEach(dp => allExpanded[dp] = true);
    setExpandedDPs(allExpanded);

    const toastId = toast.loading('Menyiapkan laporan bersih (Auto-expand & Rendering)...');
    
    // Wait for React to re-render with all categories expanded
    // and wait for any transitions to finish
    await new Promise(r => setTimeout(r, 600));

    try {
      // Find the actual table element
      const tableElement = tableRef.current.querySelector('table');
      if (!tableElement) throw new Error('Table element not found');

      const dataUrl = await toPng(tableElement, {
        backgroundColor: '#0f172a',
        style: {
          borderRadius: '0',
          position: 'static',
          margin: '0',
          padding: '20px',
        },
        pixelRatio: 2, // High resolution
        cacheBust: true,
        // filter out elements we don't want in shareable report (like expand icons if we had them)
      });
      
      const link = document.createElement('a');
      link.download = `Daily_Monitoring_Report_${selectedMonth}_Full.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Laporan bersih berhasil diekspor!', { id: toastId });
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal mengekspor gambar.', { id: toastId });
    } finally {
      // 3. Restore UI
      setExpandedDPs(prevExpanded);
      setIsExporting(false);
      setLoading(false);
    }
  };


  return (
    <div className="card glass animate-in" style={{ padding: '1rem' }}>
      <div className="card-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Daily Monitoring Report</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Monitoring Active Shipments - {selectedMonth}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={selectedMonth}
            onChange={handleMonthChange}
            className="search-input"
            style={{ width: 'auto', minWidth: '150px' }}
          >
            {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => loadDatabase(selectedMonth)} disabled={loading}>
            <RefreshCcw size={18} className={loading ? "loading-spinner" : ""} /> Refresh
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportImage} 
            disabled={loading || !monitoringData || sortedDates.length === 0}
            style={{ background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}
          >
            <Download size={18} /> Export Gambar (PNG)
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportExcel} 
            disabled={loading || !monitoringData || sortedDates.length === 0}
            style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }}
          >
            <Download size={18} /> Export Excel
          </button>
        </div>
      </div>

      <div className={`report-table-container ${isExporting ? 'exporting-mode' : ''}`} ref={tableRef}>
        {isExporting && (
          <style>{`
            .exporting-mode {
              overflow: visible !important;
              max-width: none !important;
              max-height: none !important;
              background: #0f172a !important;
            }
            .exporting-mode table {
              width: fit-content !important;
              border-collapse: collapse !important;
              margin: 20px !important;
            }
            .exporting-mode th, .exporting-mode td {
              position: static !important; /* Kill sticky */
              background: #1e293b !important;
              border: 1px solid rgba(255,255,255,0.05) !important;
            }
            .exporting-mode .total-col {
              background: #1e1b4b !important; /* Dark indigo for total */
            }
            .exporting-mode tr:nth-child(even) td {
              background: #162033;
            }
          `}</style>
        )}
        <table className="monitor-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', minWidth: '220px', position: 'sticky', left: 0, zIndex: 40, background: '#1e293b' }}>Drop Point / Category</th>
              {sortedDates.length === 0 && <th style={{ minWidth: '60px' }}>Data Kosong</th>}
              {sortedDates.map(d => (
                <th key={d} style={{ minWidth: '40px' }}>{d.slice(8)}</th>
              ))}
              <th className="total-col" style={{ position: 'sticky', right: 0, zIndex: 40, background: '#1e293b' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {(sortedDates.length === 0) ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>Tidak ada data monitoring untuk bulan ini.</p>
                </td>
              </tr>
            ) : ACTIVE_DROP_POINTS.map((dp) => {
              const dpData = monitoringData && monitoringData[dp] ? monitoringData[dp] : {};
              const categoryNames = Object.keys(dpData).filter(name => name !== 'total');
              
              categoryNames.sort((a, b) => {
                if (a === 'Regis Retur') return -1;
                if (b === 'Regis Retur') return 1;
                return a.localeCompare(b);
              });

              const dpTotal = categoryNames.reduce((sum, catName) => sum + (dpData[catName]?.total || 0), 0);
              const dpDateTotal = (d) => categoryNames.reduce((sum, catName) => sum + (dpData[catName]?.[d] || 0), 0);
              const isDPExpanded = expandedDPs[dp] || false;

              return (
                <React.Fragment key={dp}>
                  <tr 
                    className="dp-row" 
                    style={{ cursor: 'pointer', transition: 'background 0.2s' }} 
                    onClick={() => setExpandedDPs(prev => ({...prev, [dp]: !isDPExpanded}))}
                  >
                    <td style={{ position: 'sticky', left: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-main)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary)', width: '12px' }}>{isDPExpanded ? '▼' : '▶'}</span>
                      {dp}
                    </td>
                    {sortedDates.map(d => {
                      const dateTot = dpDateTotal(d);
                      return (
                        <td 
                          key={d} 
                          className={dateTot > 0 ? "interactive-cell" : ""}
                          style={{ textAlign: 'center', color: dateTot > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}
                          onClick={(e) => {
                            if (dateTot > 0) {
                              e.stopPropagation();
                              handleMonitoringCellClick(dp, null, d, dateTot);
                            }
                          }}
                          title={dateTot > 0 ? `Klik untuk melihat details ${dateTot} resi` : ''}
                        >
                          {dateTot || '-'}
                        </td>
                      )
                    })}
                    <td className="total-col" style={{ textAlign: 'center', position: 'sticky', right: 0, background: 'var(--bg-main)', borderLeft: '1px solid rgba(255,255,255,0.05)', zIndex: 20, fontWeight: 'bold' }}>{dpTotal}</td>
                  </tr>
                  
                  {isDPExpanded && categoryNames.map((catName) => {
                    const data = dpData[catName] || { total: 0 };
                    
                    let color = 'var(--text-main)';
                    if (catName === 'Regis Retur') color = 'var(--danger)';
                    else if (catName === 'Indikasi' || catName === 'Scan Paket Bermasalah') color = 'var(--warning)';

                    return (
                      <tr key={`${dp}-${catName}`} className="cat-row">
                        <td className="cat-name" style={{ paddingLeft: '2.5rem', position: 'sticky', left: 0, zIndex: 20, background: 'var(--bg-card)', borderRight: '1px solid rgba(255,255,255,0.02)' }}>
                          <span style={{ color: color, fontSize: '0.8rem' }}>{catName}</span>
                        </td>
                        {sortedDates.map(d => {
                          const val = data[d] || 0;
                          return (
                            <td 
                              key={d} 
                              className={`interactive-cell ${getCellClass(val)}`}
                              style={{ textAlign: 'center', cursor: val > 0 ? 'pointer' : 'default' }}
                              onClick={(e) => {
                                if (val > 0) {
                                  e.stopPropagation();
                                  handleMonitoringCellClick(dp, catName, d, val);
                                }
                              }}
                              title={val > 0 ? `Klik untuk melihat details tracking untuk ${val} resi` : ''}
                            >
                              {val || '-'}
                            </td>
                          );
                        })}
                        <td className="total-col" style={{ textAlign: 'center', position: 'sticky', right: 0, background: 'var(--bg-card)', borderLeft: '1px solid rgba(255,255,255,0.02)', zIndex: 20 }}>
                          {data.total || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
          {sortedDates.length > 0 && (
            <tfoot>
              <tr>
                <th style={{ textAlign: 'left', position: 'sticky', left: 0, zIndex: 40, background: '#1e293b', color: '#fff', borderTop: '2px solid #334155' }}>GRAND TOTAL</th>
                {sortedDates.map(d => (
                  <th key={d} style={{ textAlign: 'center', background: '#1e293b', color: '#fff', borderTop: '2px solid #334155' }}>{dateTotals[d]}</th>
                ))}
                <th className="total-col" style={{ position: 'sticky', right: 0, zIndex: 40, background: '#1e293b', color: 'var(--primary)', fontWeight: '900', fontSize: '1rem', borderTop: '2px solid #3b82f6' }}>
                  {grandTotal}
                </th>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {trackingModalData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.7)', zIndex: 1000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}
        onClick={() => setTrackingModalData(null)}>
          <div 
            className="card glass animate-in" 
            style={{ width: '90%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '1.5rem', margin: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <h2 className="card-title">Tracking Details</h2>
              <button 
                className="btn" 
                style={{ padding: '0.25rem 0.5rem', background: 'rgba(255, 255, 255, 0.1)', border: 'none' }} 
                onClick={() => setTrackingModalData(null)}
              >
                <X size={20} color="var(--text-main)" />
              </button>
            </div>
            
            <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><strong>Drop Point:</strong> <span style={{ color: 'var(--text-main)' }}>{trackingModalData.dropPoint}</span></div>
              <div><strong>Tanggal:</strong> <span style={{ color: 'var(--text-main)' }}>{trackingModalData.date}</span></div>
              <div><strong>Kategori:</strong> <span style={{ color: 'var(--primary)' }}>{trackingModalData.category}</span></div>
              <div><strong>Total Paket:</strong> <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{trackingModalData.total}</span></div>
            </div>
            
            <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Daftar No Waybill:</h3>
            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {trackingModalData.waybills.map(wb => (
                  <li 
                    key={wb} 
                    style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '0.25rem', fontFamily: 'monospace', fontSize: '0.95rem', color: 'var(--primary)', cursor: 'pointer', transition: 'background 0.2s', border: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                    onClick={() => setActiveTrackingWaybill(wb)}
                  >
                    {wb} <span style={{ float: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Track / VOID ▶</span>
                  </li>
                ))}
                {trackingModalData.waybills.length === 0 && (
                  <li style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada data ditemukan.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTrackingWaybill && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(15, 23, 42, 0.95)', zIndex: 2000, 
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ width: '95%', height: '90%', background: 'initial', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <Tracking 
              initialWaybill={activeTrackingWaybill} 
              isPopup={true} 
              onClose={() => {
                setActiveTrackingWaybill(null);
                // Optionally if we voided, we might want to refresh DB, but closing should return to exact state
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
};
