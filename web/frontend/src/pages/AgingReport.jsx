import React, { useState, useEffect } from 'react';
import { 
  RefreshCcw, 
  Search, 
  Download, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  HelpCircle,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatDateTime, formatCurrency } from '../utils/formatters';
import { fetchAgingDetails } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const AgingReport = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ total: 0, already_retur: 0, belum_retur: 0, dp_summary: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, retur, belum
  const [filterDP, setFilterDP] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAgingDetails();
      if (res.success) {
        setData(res.data.details || []);
        setSummary(res.data.summary || {});
        toast.success(`Berhasil memuat ${res.data.details?.length || 0} data aging`);
      }
    } catch (error) {
      toast.error('Gagal memuat data Aging Report');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!filteredData || filteredData.length === 0) {
      toast.error("Tidak ada data untuk diunduh");
      return;
    }

    const isHandled = (regisDate) => {
      if (!regisDate || regisDate === 'null' || String(regisDate).includes('0001')) return false;
      const date = new Date(regisDate);
      if (isNaN(date.getTime()) || date.getFullYear() < 2010) return false;
      
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1; 
      // Diff 0 (today), 1 (yesterday), 2 (2 days ago)
      return diffDays <= 2;
    };

    const worksheetData = filteredData.map(item => {
      const isRetur = isHandled(item.waktu_regis_retur);
      return {
        'No Waybill': item.waybill_id || '-',
        'Umur (Hari)': item.aging_days,
        'Drop Point': item.drop_point || '-',
        'Waktu Sampai': formatDateTime(item.waktu_sampai),
        'Status Penanganan': isRetur ? 'SUDAH DITANGANI' : 'BELUM DITANGANI',
        'Waktu Regis Retur': formatDateTime(item.waktu_regis_retur),
        'Alasan Masalah': item.alasan_masalah || '-',
        'Station Terakhir': item.station_scan || '-',
        'Jenis Scan': item.jenis_scan || '-',
        'Waktu Scan Terakhir': formatDateTime(item.waktu_scan)
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Aging");
    XLSX.writeFile(workbook, `Laporan_Aging_3plus_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Laporan Excel berhasil diunduh');
  };

  const filteredData = data.filter(row => {
    const isHandled = (regisDate) => {
      if (!regisDate || regisDate === 'null' || String(regisDate).includes('0001')) return false;
      const date = new Date(regisDate);
      if (isNaN(date.getTime()) || date.getFullYear() < 2010) return false;
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
      return diffDays <= 2;
    };

    const search = searchTerm.toLowerCase();
    const handled = isHandled(row.waktu_regis_retur);
    
    // DP Access Control Check
    if (user && user.role !== 'RM' && user.dp_access && user.dp_access.trim() !== '*') {
      const allowed = user.dp_access.split(',').map(d => d.trim().toLowerCase());
      const rowDP = (row.drop_point || '').toLowerCase();
      if (!allowed.includes(rowDP)) return false;
    }
    
    const matchesSearch = (
      (row.waybill_id || '').toLowerCase().includes(search) ||
      (row.drop_point || '').toLowerCase().includes(search) ||
      (row.alasan_masalah || '').toLowerCase().includes(search)
    );

    const matchesStatus = 
      filterStatus === 'all' ? true : 
      filterStatus === 'retur' ? handled : !handled;

    const matchesDP = filterDP === 'all' ? true : row.drop_point === filterDP;

    return matchesSearch && matchesStatus && matchesDP;
  });

  const allDropPoints = Object.keys(summary.dp_summary || {}).sort();
  const dropPoints = user?.role !== 'RM' && user?.dp_access && user.dp_access !== '*'
    ? allDropPoints.filter(dp => user.dp_access.toLowerCase().includes(dp.toLowerCase()))
    : allDropPoints;

  return (
    <div className="animate-in">
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card glass stats-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stats-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stats-label">Total Paket Aging (&gt;= 3 Hari)</div>
            <div className="stats-value">{loading ? '...' : summary.total}</div>
          </div>
        </div>

        <div className="card glass stats-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stats-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="stats-label">Sudah Ditangani (Regis &lt; 3 Hari)</div>
            <div className="stats-value text-success">{loading ? '...' : summary.already_retur}</div>
          </div>
        </div>

        <div className="card glass stats-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stats-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
            <HelpCircle size={24} />
          </div>
          <div>
            <div className="stats-label">Nunggak / Belum Ditangani</div>
            <div className="stats-value text-danger">{loading ? '...' : summary.belum_retur}</div>
          </div>
        </div>
      </div>

      <div className="card glass">
        <div className="card-header">
          <h2 className="card-title">Detail Laporan Aging (+3 Hari)</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-success" onClick={handleDownloadExcel}>
              <Download size={18} /> Export Excel
            </button>
            <button className="btn btn-primary" onClick={loadData} disabled={loading}>
              <RefreshCcw size={18} className={loading ? "loading-spinner" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-container" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Cari No Waybill atau Alasan..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={18} style={{ color: 'var(--text-muted)' }} />
            <select 
              className="search-input" 
              style={{ width: '150px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="retur">Sudah Ditangani</option>
              <option value="belum">Belum/Nunggak</option>
            </select>

            <select 
              className="search-input" 
              style={{ width: '150px' }}
              value={filterDP}
              onChange={(e) => setFilterDP(e.target.value)}
            >
              <option value="all">Semua DP</option>
              {dropPoints.map(dp => (
                <option key={dp} value={dp}>{dp}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>No Waybill</th>
                <th style={{ textAlign: 'center' }}>Aging</th>
                <th>Drop Point</th>
                <th>Status Penanganan</th>
                <th>Waktu Regis Retur</th>
                <th>Alasan Masalah</th>
                <th>Waktu Scan Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    <RefreshCcw size={32} className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
                    <p>Memproses data aging...</p>
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((row, idx) => {
                  const isValidDate = (d) => {
                    if (!d || d === 'null' || String(d).includes('0001')) return false;
                    const date = new Date(d);
                    return !isNaN(date.getTime()) && date.getFullYear() >= 2010;
                  };
                  const isRetur = isValidDate(row.waktu_regis_retur);
                  return (
                    <tr key={idx}>
                      <td><strong>{row.waybill_id}</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-red">{row.aging_days} Hari</span>
                      </td>
                      <td>{row.drop_point || '-'}</td>
                      <td>
                        <span className={`badge ${isRetur ? 'badge-green' : 'badge-red'}`}>
                          {isRetur ? 'SUDAH DITANGANI' : 'BELUM DITANGANI'}
                        </span>
                      </td>
                      <td>{formatDateTime(row.waktu_regis_retur)}</td>
                      <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.alasan_masalah}>
                        {row.alasan_masalah || '-'}
                      </td>
                      <td>{formatDateTime(row.waktu_scan)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    <p>Tidak ada paket aging yang ditemukan sesuai kriteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
