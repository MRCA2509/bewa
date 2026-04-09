import React, { useState, useEffect } from 'react';
import { RefreshCcw, Search, Download, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatDateTime, formatCurrency } from '../utils/formatters';
import { fetchDatabase, fetchBatchWaybills } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const ActiveShipments = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    loadData(page, limit);
  }, [page, limit]);

  const loadData = async (currentPage, currentLimit) => {
    setLoading(true);
    try {
      const res = await fetchDatabase(currentPage, currentLimit);
      if (res.success) {
        setData(res.data.active || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.total_pages || 1);
          setTotalRecords(res.data.pagination.total || 0);
        }
        toast.success(`Berhasil memuat halaman ${currentPage}`);
      }
    } catch (error) {
      toast.error('Gagal memuat data Active Shipments');
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

    const worksheetData = filteredData.map(item => {
      let umurPaket = '-';
      if (item.waktu_sampai && !item.waktu_sampai.includes('0001')) {
        const cleanSamp = item.waktu_sampai.endsWith(' GMT') ? item.waktu_sampai.replace(' GMT', '') : item.waktu_sampai;
        const samp = new Date(cleanSamp);
        const now = new Date();
        const sampDate = new Date(samp.getFullYear(), samp.getMonth(), samp.getDate());
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.floor((nowDate - sampDate) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          umurPaket = (diffDays + 1) + ' Hari';
        }
      }

      return {
        'No Waybill': item.waybill_id || '-',
        'Umur Paket': umurPaket,
        'Waktu Sampai': formatDateTime(item.waktu_sampai),
        'Drop Point': item.drop_point || '-',
        'COD': item.biaya_cod || 0,
        'DFOD': item.total_dfod || 0,
        'Waktu Regis Retur': formatDateTime(item.waktu_regis_retur),
        'Waktu Konfirmasi Retur': formatDateTime(item.waktu_konfirmasi_retur),
        'Station Scan': item.station_scan || '-',
        'Jenis Scan': item.jenis_scan || '-',
        'Waktu Scan': formatDateTime(item.waktu_scan),
        'Alasan Masalah': item.alasan_masalah || '-',
        'Lokasi Berikutnya': item.lokasi_berikutnya || '-'
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Active Shipments");
    XLSX.writeFile(workbook, `Active_Shipments_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('File Excel berhasil diunduh');
  };

  const handleDownloadBatchJMS = async () => {
    const toastId = toast.loading('Memproses batch JMS...');
    try {
      const res = await fetchBatchWaybills();
      if (!res.success) throw new Error(res.error);
      
      const waybills = res.data;
      if (!waybills || waybills.length === 0) {
        toast.error('Tidak ada resi aktif untuk diunduh', { id: toastId });
        return;
      }
      
      const BATCH_SIZE = 9990;
      const numBatches = Math.ceil(waybills.length / BATCH_SIZE);
      
      for (let i = 0; i < numBatches; i++) {
        const batch = waybills.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const worksheetData = batch.map(wb => ({ 'No. Waybill': wb }));
        
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Batch ${i+1}`);
        
        setTimeout(() => {
          XLSX.writeFile(workbook, `JMS_Update_Batch_${i+1}.xlsx`);
        }, i * 500); // Stagger downloads slightly
      }
      
      toast.success(`Berhasil memecah & mengunduh ${numBatches} file Batch JMS!`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Gagal membuat file Batch JMS', { id: toastId });
    }
  };

  const filteredData = data.filter(row => {
    if (user && user.role !== 'RM' && user.dp_access && user.dp_access.trim() !== '*') {
      const allowed = user.dp_access.split(',').map(d => d.trim().toLowerCase());
      const rowDP = (row.drop_point || '').toLowerCase();
      if (!allowed.includes(rowDP)) return false;
    }
    
    const search = searchTerm.toLowerCase();
    return (
      (row.waybill_id || '').toLowerCase().includes(search) ||
      (row.drop_point || '').toLowerCase().includes(search) ||
      (row.station_scan || '').toLowerCase().includes(search) ||
      (row.jenis_scan || '').toLowerCase().includes(search) ||
      (row.alasan_masalah || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="animate-in card glass">
      <div className="card-header">
        <h2 className="card-title">Active Shipments Database</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleDownloadBatchJMS} style={{ background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}>
            <Download size={18} /> Download Batch (JMS)
          </button>
          <button className="btn btn-success" onClick={handleDownloadExcel}>
            <Download size={18} /> Export Excel (Halaman Ini)
          </button>
          <button className="btn btn-primary" onClick={() => loadData(page, limit)} disabled={loading}>
            <RefreshCcw size={18} className={loading ? "loading-spinner" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="search-container">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            placeholder="Cari berdasarkan No Waybill, Drop Point, Jenis Scan, Station, atau Alasan Masalah..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <strong style={{ color: 'var(--primary)' }}>Data Total:</strong> {totalRecords} records (Menampilkan hasil filter: {filteredData.length})
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Tampilkan:</span>
          <select 
            value={limit} 
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            style={{ padding: '0.25rem', borderRadius: '4px', background: 'var(--bg-lighter)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={2000}>2000</option>
          </select>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>No Waybill</th>
              <th>Umur Paket</th>
              <th>Waktu Sampai</th>
              <th>Drop Point</th>
              <th>COD</th>
              <th>DFOD</th>
              <th>Waktu Regis Retur</th>
              <th>Waktu Konfirmasi Retur</th>
              <th>Station Scan</th>
              <th>Jenis Scan</th>
              <th>Waktu Scan</th>
              <th>Alasan Masalah</th>
              <th>Lokasi Berikutnya</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="13" style={{ textAlign: 'center', padding: '2rem' }}>Memuat data...</td></tr>
            ) : filteredData.length > 0 ? (
              filteredData.map((row, idx) => {
                let umurPaket = '-';
                if (row.waktu_sampai && !row.waktu_sampai.includes('0001')) {
                  const cleanSamp = typeof row.waktu_sampai === 'string' && row.waktu_sampai.endsWith(' GMT') ? row.waktu_sampai.replace(' GMT', '') : row.waktu_sampai;
                  const samp = new Date(cleanSamp);
                  const now = new Date();
                  const sampDate = new Date(samp.getFullYear(), samp.getMonth(), samp.getDate());
                  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const diffDays = Math.floor((nowDate - sampDate) / (1000 * 60 * 60 * 24));
                  if (diffDays >= 0) {
                    umurPaket = (diffDays + 1) + ' Hari';
                  }
                }

                return (
                  <tr key={idx}>
                    <td><strong>{row.waybill_id}</strong></td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${parseInt(umurPaket) >= 3 ? 'badge-red' : 'badge-green'}`}>
                        {umurPaket}
                      </span>
                    </td>
                    <td>{formatDateTime(row.waktu_sampai)}</td>
                    <td>{row.drop_point || '-'}</td>
                    <td>Rp {formatCurrency(row.biaya_cod)}</td>
                    <td>Rp {formatCurrency(row.total_dfod)}</td>
                    <td style={{ color: row.waktu_regis_retur && !row.waktu_regis_retur.includes('0001') ? 'var(--danger)' : 'inherit' }}>
                      {formatDateTime(row.waktu_regis_retur)}
                    </td>
                    <td>{formatDateTime(row.waktu_konfirmasi_retur)}</td>
                    <td>{row.station_scan || '-'}</td>
                    <td><span className="badge badge-orange">{row.jenis_scan || '-'}</span></td>
                    <td>{formatDateTime(row.waktu_scan)}</td>
                    <td style={{ color: 'var(--danger)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.alasan_masalah}>
                      {row.alasan_masalah || '-'}
                    </td>
                    <td>{row.lokasi_berikutnya || '-'}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>Tidak ada data aktif yang ditemukan.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Halaman {page} dari {totalPages}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary" 
            disabled={page === 1 || loading}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Sebelumnya
          </button>
          <button 
            className="btn btn-primary" 
            disabled={page >= totalPages || loading}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Selanjutnya
          </button>
        </div>
      </div>
    </div>
  );
};
