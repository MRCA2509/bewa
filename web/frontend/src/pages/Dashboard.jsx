import React, { useState, useEffect } from 'react';
import { Database, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { fetchStats, fetchSummary } from '../services/api';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { DownloadCloud } from 'lucide-react';

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const leaderboardRef = React.useRef(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const downloadLeaderboard = async () => {
    if (!leaderboardRef.current) return;
    try {
      const dataUrl = await toPng(leaderboardRef.current, { backgroundColor: '#0f172a', quality: 1 });
      const link = document.createElement('a');
      link.download = `Leaderboard_Progress_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Leaderboard berhasil diunduh');
    } catch (err) {
      toast.error('Gagal mengunduh gambar');
      console.error(err);
    }
  };

  const loadData = async () => {
    try {
      const [statsRes, summaryRes] = await Promise.all([
        fetchStats(),
        fetchSummary()
      ]);
      setStats(statsRes.stats);
      setSummaryData(summaryRes.summary);
    } catch (error) {
      toast.error('Gagal memuat data Dashboard');
      console.error(error);
    }
  };

  return (
    <div className="animate-in">
      <div className="stats-grid">
        <StatCard icon={<Database size={24} />} value={stats?.total_records} label="Total Records" />
        <StatCard icon={<Package size={24} />} value={stats?.active_shipments} label="Active Shipments" color="rgba(59, 130, 246, 0.15)" />
        <StatCard icon={<CheckCircle size={24} />} value={stats?.history_shipments} label="History / Delivered" color="rgba(16, 185, 129, 0.15)" />
        <StatCard icon={<Truck size={24} />} value={stats?.unique_waybills} label="Unique Waybills" color="rgba(245, 158, 11, 0.15)" />
        <StatCard icon={<Clock size={24} />} value={stats?.last_sync} label="Last Updated" color="rgba(99, 102, 241, 0.15)" isText />
      </div>

      {summaryData && (
        <>
          <div className="card glass">
            <div className="card-header">
              <h2 className="card-title">Rata-rata Paket Masuk per DP (Harian) - Perbandingan Bulanan</h2>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryData.dp_comparisons || []} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="drop_point" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem'
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#94a3b8' }} />
                  <Bar dataKey="avg_current" name={`Bulan Ini (${summaryData?.current_month || '-'})`} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avg_last" name={`Bulan Lalu (${summaryData?.last_month || '-'})`} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card glass">
            <div className="card-header">
              <h2 className="card-title">Rata-rata Incoming vs Sisa Active Shipments (Bulan Ini)</h2>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryData.dp_comparisons || []} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="drop_point" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem'
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#94a3b8' }} />
                  <Bar dataKey="avg_current" name="Rata-rata Paket Masuk/Hari" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="active_current" name="Sisa Active Shipments" fill="var(--danger, #f43f5e)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card glass" ref={leaderboardRef}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">🏆 Leaderboard Progress Cleanup (Total Backlog)</h2>
              <button className="btn btn-primary" onClick={downloadLeaderboard} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                <DownloadCloud size={16} /> Download
              </button>
            </div>
            
            {/* Legend / Explanation */}
            <div style={{ padding: '0 1.5rem', marginBottom: '0.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: '#eab308', borderRadius: '2px' }}></div>
                <span style={{ color: '#94a3b8' }}>Sisa Target AKTIF (Belum Ditangani)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}></div>
                <span style={{ color: '#94a3b8' }}>Selesai Hari Ini (Retur/TTD)</span>
              </div>
            </div>

            <div className="chart-container" style={{ height: '380px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={summaryData.dp_ranking || []} 
                  layout="vertical" 
                  margin={{ left: 10, right: 30, top: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis dataKey="drop_point" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem'
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  />
                  <Legend verticalAlign="top" height={30} />
                  <Bar 
                    dataKey="unhandled_packages" 
                    name="Sisa Target AKTIF" 
                    stackId="a" 
                    fill="#eab308" 
                  />
                  <Bar 
                    dataKey="handled_packages" 
                    name="Selesai Hari Ini" 
                    stackId="a" 
                    fill="#10b981" 
                    radius={[0, 4, 4, 0]}
                    label={(props) => {
                      const { x, y, width, value, payload, index } = props;
                      if (!payload) return null;
                      return (
                        <text 
                          x={x + width + 5} 
                          y={y + 15} 
                          fill="#cbd5e1" 
                          fontSize={10}
                        >
                          {payload.unhandled_packages} sisa target
                        </text>
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '0.5rem', flex: 1, minWidth: '200px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginBottom: '0.25rem' }}>TERBAIK 🦅</div>
                <div style={{ color: '#fff' }}>
                  {(summaryData.dp_ranking && summaryData.dp_ranking.length > 0) ? summaryData.dp_ranking[0].drop_point : '-'}
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '0.5rem' }}>({summaryData.dp_ranking?.[0]?.unhandled_packages || 0} sisa target aktif)</span>
                </div>
              </div>
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '0.75rem', borderRadius: '0.5rem', flex: 1, minWidth: '200px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                <div style={{ fontSize: '0.75rem', color: '#f43f5e', fontWeight: 600, marginBottom: '0.25rem' }}>PERLU PERHATIAN 🐢</div>
                <div style={{ color: '#fff' }}>
                  {(summaryData.dp_ranking && summaryData.dp_ranking.length > 0) ? summaryData.dp_ranking[summaryData.dp_ranking.length - 1].drop_point : '-'}
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '0.5rem' }}>({summaryData.dp_ranking?.[summaryData.dp_ranking.length - 1]?.unhandled_packages || 0} sisa target aktif)</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon, value, label, color, isText }) => (
  <div className="stat-card">
    <div className="stat-icon" style={color ? { background: color } : {}}>
      {icon}
    </div>
    <div>
      <span className="stat-value" style={isText ? { fontSize: '1rem', lineHeight: '1.5rem' } : {}}>
        {value !== undefined ? (isText ? value : value.toLocaleString()) : '0'}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  </div>
);
