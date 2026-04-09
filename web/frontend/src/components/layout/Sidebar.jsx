import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Database,
  Search,
  FileSpreadsheet,
  Activity,
  Menu,
  Clock,
  BarChart3,
  Zap,
  Users,
  LogOut,
  Truck,
  Monitor,
  Map
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ isMini, setIsMini }) => {
  const toggleSidebar = () => setIsMini(!isMini);
  const { user, logout } = useAuth();

  return (
    <aside className={`sidebar glass ${isMini ? 'mini' : ''}`}>
      <div className="sidebar-header" style={{ marginBottom: '1.5rem' }}>
        <Activity className="sidebar-logo text-primary" style={{ color: 'var(--primary)', flexShrink: 0 }} />
        {!isMini && <span className="sidebar-title">Bewa Assisten DP</span>}
      </div>
      
      {user && !isMini && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          padding: '1.5rem 1rem', 
          marginBottom: '0.5rem', 
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          textAlign: 'center'
        }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '50%', 
            background: 'var(--accent-gradient)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '0.75rem',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            <Users size={24} color="white" />
          </div>
          <div style={{ 
            fontSize: '1.1rem', 
            fontWeight: '900', 
            color: 'white', 
            marginBottom: '0.25rem',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {user.name}
          </div>
          <div style={{ 
            fontSize: '0.7rem', 
            color: 'var(--primary)', 
            fontWeight: '700', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em' 
          }}>
            {user.role}
          </div>
        </div>
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
        <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" isMini={isMini} />
        <SidebarLink to="/upload" icon={<Upload size={20} />} label="Upload Data" isMini={isMini} />
        <SidebarLink to="/active-shipments" icon={<Database size={20} />} label="Active Shipments" isMini={isMini} />
        <SidebarLink to="/history-shipments" icon={<Clock size={20} />} label="History Shipments" isMini={isMini} />
        <SidebarLink to="/aging-report" icon={<FileSpreadsheet size={20} />} label="Laporan Aging (+3 Hari)" isMini={isMini} />
        <SidebarLink to="/monitoring" icon={<Monitor size={20} />} label="Control Tower" isMini={isMini} />
        <SidebarLink to="/daily-progress" icon={<Activity size={20} />} label="Laporan Progress Harian" isMini={isMini} />
        <SidebarLink to="/sprinter-report" icon={<Map size={20} />} label="Monitoring POD Kurir" isMini={isMini} />
        <SidebarLink to="/tracking" icon={<Search size={20} />} label="Track Waybill" isMini={isMini} />
        <SidebarLink to="/auto-feedback" icon={<Zap size={20} />} label="Auto Feedback" isMini={isMini} />
        <SidebarLink to="/upload-pod" icon={<Truck size={20} />} label="Upload Bukti POD" isMini={isMini} />
        {user?.role === 'RM' && (
           <>
             <SidebarLink to="/users" icon={<Users size={20} />} label="Manajemen User" isMini={isMini} />
             <button className="sidebar-item" onClick={async () => {
               if(window.confirm('PERINGATAN: Tindakan ini akan mengekspor database lokal ini dan mengirimkannya ke VPS Cloud untuk ditimpa. Lanjutkan?')) {
                 try {
                   const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/actions/run-sync-master', {
                     method: 'POST',
                     headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                   });
                   const data = await res.json();
                   if(data.success) {
                     alert('Berhasil: ' + data.message);
                   } else {
                     alert('Gagal: ' + data.message);
                   }
                 } catch(e) {
                   alert('Error menghubungi server: ' + e.message);
                 }
               }
             }} style={{ justifyContent: isMini ? 'center' : 'flex-start', color: 'var(--warning)' }}>
               <Zap size={20} />
               {!isMini && <span>Deploy & Sync Master</span>}
             </button>
           </>
        )}
      </nav>

      <button className="sidebar-item text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={logout} style={{ justifyContent: isMini ? 'center' : 'flex-start', marginTop: 'auto', marginBottom: '8px' }}>
        <LogOut size={20} />
        {!isMini && <span>Logout</span>}
      </button>

      <button className="sidebar-item" onClick={toggleSidebar} style={{ justifyContent: isMini ? 'center' : 'flex-start' }}>
        <Menu size={20} />
        {!isMini && <span>Collapse Sidebar</span>}
      </button>
    </aside>
  );
};

const SidebarLink = ({ to, icon, label, isMini }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
      style={{ justifyContent: isMini ? 'center' : 'flex-start' }}
      title={isMini ? label : ''}
    >
      {icon}
      {!isMini && <span>{label}</span>}
    </NavLink>
  );
};
