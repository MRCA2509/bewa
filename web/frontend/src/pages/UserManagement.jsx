import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Users, Trash2, Shield, MapPin } from 'lucide-react';

export const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('KOORDINATOR');
  const [dpAccess, setDpAccess] = useState('');
  
  const [message, setMessage] = useState('');
  const [availableDPs, setAvailableDPs] = useState([]);

  const fetchUsers = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUsers(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDPs = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/sync/list-drop-points`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAvailableDPs(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user?.role === 'RM') {
      fetchUsers();
      fetchDPs();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, password, role, dp_access: dpAccess, name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal meregistrasi user');
      
      setMessage('User berhasil ditambahkan!');
      setUsername(''); setPassword(''); setName(''); setDpAccess('');
      fetchUsers();
    } catch (err) {
      setMessage(err.message || 'Gagal meregistrasi user');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus user ini?')) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus');
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Gagal menghapus');
    }
  };

  if (user?.role !== 'RM') {
    return <div className="card glass animate-in" style={{ textAlign: 'center', padding: '4rem' }}>Akses Terbatas. Halaman ini hanya untuk Regional Manager.</div>;
  }

  return (
    <div className="animate-in space-y-6">
      <div className="card-header">
        <div>
          <h1 className="card-title">Manajemen Akun Pengguna</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Kelola akses sistem untuk Supervisor dan Koordinator Drop Point.</p>
        </div>
      </div>

      <div className="grid-cols-management">
        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
            <UserPlus size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Tambah Akun Baru</h2>
          </div>
          
          {message && (
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontSize: '0.875rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nama Lengkap</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="search-input" style={{ width: '100%' }} placeholder="Contoh: Budi Santoso" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Username Login</label>
              <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="search-input" style={{ width: '100%' }} placeholder="Username unik" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="search-input" style={{ width: '100%' }} placeholder="Minimal 6 karakter" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Jabatan (Role)</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="search-input" style={{ width: '100%' }}>
                <option value="KOORDINATOR">Koordinator (1 Drop Point)</option>
                <option value="SPV">Supervisor (Multi Drop Point)</option>
                <option value="ADMIN">Admin (Operasional Desktop)</option>
                <option value="RM">Regional Manager (Global)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Akses Drop Point</label>
              {role === 'RM' ? (
                <input 
                  type="text" 
                  disabled
                  value="*" 
                  className="search-input" 
                  style={{ width: '100%', backgroundColor: 'var(--bg-muted)' }} 
                />
              ) : (
                <select 
                  multiple={role === 'SPV'}
                  required 
                  value={role === 'SPV' ? (dpAccess ? dpAccess.split(',') : []) : dpAccess} 
                  onChange={e => {
                    if (role === 'SPV') {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setDpAccess(values.join(','));
                    } else {
                      setDpAccess(e.target.value);
                    }
                  }} 
                  className="search-input" 
                  style={{ width: '100%', height: role === 'SPV' ? '100px' : 'auto' }}
                >
                  <option value="">-- Pilih Drop Point --</option>
                  {availableDPs.map(dp => (
                    <option key={dp} value={dp}>{dp}</option>
                  ))}
                </select>
              )}
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {role === 'SPV' ? 'Tahan Ctrl untuk memilih lebih dari satu' : (role === 'RM' ? 'Otomatis akses semua wilayah' : 'Pilih cabang operasional')}
              </p>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}>Simpan Akun</button>
          </form>
        </div>

        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
            <Users size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Daftar Pengguna Aktif</h2>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Wewenang Wilayah</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Memuat...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Shield size={14} style={{ color: u.role === 'RM' ? 'var(--warning)' : 'inherit' }} /> {u.name}</div></td>
                    <td><span style={{ color: 'var(--primary)', fontWeight: 500 }}>{u.username}</span></td>
                    <td><span className={`badge ${u.role === 'RM' ? 'badge-orange' : 'badge-blue'}`}>{u.role}</span></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MapPin size={12} /> {u.dp_access}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {u.role !== 'RM' ? (
                        <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Hapus User">
                          <Trash2 size={18} />
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Belum ada data user.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
