import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Truck, CheckCircle2, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { fetchStats } from '../services/api'; // Assuming we might add a specific report fetcher or use generic fetch

export const SprinterReport = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/reports/sprinter-pod`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (res.ok) {
        setData(result.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const getPercentage = (completed, total) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  return (
    <div className="animate-in space-y-8">
      {/* Header Section */}
      <div className="card-header flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="card-title text-3xl font-extrabold tracking-tight">Monitoring POD Kurir</h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
             <div className="pulsing-dot" />
             <span>Data tersinkronisasi dari Desktop Bridge Lokal</span>
          </div>
        </div>
        <button 
          onClick={fetchData} 
          disabled={isRefreshing}
          className="btn btn-primary shadow-lg shadow-blue-500/20 group"
        >
          <RefreshCw size={18} className={`${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          {isRefreshing ? 'Memperbarui...' : 'Refresh Status'}
        </button>
      </div>

      {/* Main Table Card */}
      <div className="card glass overflow-hidden border-white/5 shadow-2xl">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3 text-blue-400">
            <div className="p-2 bg-blue-500/10 rounded-xl">
               <Truck size={22} />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Capaian Real-time Sprinter</h2>
          </div>
          <div className="text-xs font-semibold px-3 py-1 bg-slate-800/50 rounded-full border border-white/5 text-slate-400 uppercase tracking-widest">
             {data.length} Sprinter Active
          </div>
        </div>

        <div className="report-table-container custom-scrollbar">
          <table className="monitor-table">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="text-left pl-8">Wilayah (DP)</th>
                <th className="text-left">Identitas Sprinter</th>
                <th className="text-center">Status Pekerjaan</th>
                <th className="text-left">Progress Bar</th>
                <th className="text-right pr-8">Sinkron Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="p-20 text-center"><div className="loading-spinner mx-auto mb-4" /> <span className="text-slate-500 font-medium">Menghubungkan ke satelit data...</span></td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="5" className="p-20 text-center text-slate-500 italic font-medium">Tidak ada data penugasan kurir ditemukan untuk wilayah Anda.</td></tr>
              ) : (
                data.map((row, i) => {
                  const pct = getPercentage(row.completed_tasks, row.total_tasks);
                  const isComplete = pct === 100 && row.total_tasks > 0;
                  
                  return (
                    <tr key={i} className="cat-row group border-b border-white/[0.02]">
                      <td className="pl-8">
                        <span className={`badge ${isComplete ? 'badge-green' : 'badge-blue'} py-1 px-4 text-[10px] font-black uppercase`}>
                           {row.drop_point}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                           <span className="text-slate-100 font-bold group-hover:text-blue-400 transition-colors uppercase tracking-tight">{row.sprinter_name}</span>
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{row.sprinter_code}</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isComplete ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-orange-500/5 border-orange-500/20 text-orange-400'}`}>
                          {isComplete ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          <span className="text-xs font-black">
                            {row.completed_tasks} / {row.total_tasks}
                          </span>
                        </div>
                      </td>
                      <td className="min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
                            <div 
                                className={`h-full transition-all duration-1000 ease-out ${isComplete ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'}`}
                                style={{ width: `${pct}%` }} 
                            />
                          </div>
                          <span className={`text-xs font-black w-8 text-right ${isComplete ? 'text-emerald-400' : 'text-slate-400'}`}>{pct}%</span>
                        </div>
                      </td>
                      <td className="text-right pr-8">
                          <div className="flex flex-col items-end gap-0.5">
                             <span className="text-[11px] font-bold text-slate-300">
                                {row.last_completed_at ? new Date(row.last_completed_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                             </span>
                             <span className="text-[10px] text-slate-500 font-medium">
                                {row.last_completed_at ? new Date(row.last_completed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':') : ''}
                             </span>
                          </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="card glass border-blue-500/10 bg-blue-500/[0.02] p-6 flex gap-4 items-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
               <AlertCircle size={24} />
            </div>
            <div>
               <h4 className="font-bold text-slate-200">Informasi Sinkronisasi</h4>
               <p className="text-sm text-slate-400 leading-relaxed">Status update dikirimkan otomatis saat Kurir menekan tombol "Kirim Data POD" pada aplikasi mobile.</p>
            </div>
         </div>
         <div className="card glass border-emerald-500/10 bg-emerald-500/[0.02] p-6 flex gap-4 items-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
               <CheckCircle2 size={24} />
            </div>
            <div>
               <h4 className="font-bold text-slate-200">Validasi Data</h4>
               <p className="text-sm text-slate-400 leading-relaxed">Data yang muncul disini bersifat kumulatif harian dan akan di-reset setiap pergantian shift operasional.</p>
            </div>
         </div>
      </div>
    </div>
  );
};
