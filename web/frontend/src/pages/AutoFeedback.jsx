import React, { useState, useRef } from 'react';
import { 
  Upload as UploadIcon, 
  FileUp, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  FileSpreadsheet, 
  Zap, 
  ShieldCheck, 
  Search, 
  ArrowRight,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadAutoFeedback } from '../services/api';

export const AutoFeedback = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: Process, 3: Success
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (validTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
      setFile(selectedFile);
      setCurrentStep(1);
    } else {
      toast.error('Format file tidak didukung. Harap upload file Excel (.xlsx atau .xls)');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Pilih file terlebih dahulu');
      return;
    }

    setLoading(true);
    setCurrentStep(2);
    let toastId = toast.loading(`Menganalisa dan Memproses ${file.name}...`);

    try {
      const blob = await uploadAutoFeedback(file);
      
      // Auto Download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name.replace(/\.[^/.]+$/, "") + '_Bewa_Feedback.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setCurrentStep(3);
      toast.success('Analisa Berhasil! File diunduh otomatis.', { id: toastId });
    } catch (err) {
      setCurrentStep(1);
      toast.error(`Gagal: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const resetProcess = () => {
    setFile(null);
    setCurrentStep(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="animate-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Section */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.75rem', 
          padding: '0.5rem 1.25rem', 
          background: 'rgba(59, 130, 246, 0.1)', 
          borderRadius: '999px',
          color: 'var(--primary)',
          fontSize: '0.875rem',
          fontWeight: '600',
          marginBottom: '1rem',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <Zap size={16} />
          <span>Sistem Analisa Cepat (Pandas Engine)</span>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Auto Feedback Generator
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', maxWidth: '700px', margin: '0 auto' }}>
          Berikan feedback otomatis untuk ribuan resi dalam hitungan detik. Cukup unggah, biar Bewa yang bekerja.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="step-indicator">
        <div className={`step-item ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
          <div className="step-number">{currentStep > 1 ? <CheckCircle size={20} /> : '1'}</div>
          <span className="step-label">Upload</span>
        </div>
        <div style={{ width: '100px', height: '2px', background: currentStep > 1 ? 'var(--success)' : 'var(--glass-border)', marginTop: '-20px' }}></div>
        <div className={`step-item ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
          <div className="step-number">{currentStep > 2 ? <CheckCircle size={20} /> : '2'}</div>
          <span className="step-label">Proses Analisa</span>
        </div>
        <div style={{ width: '100px', height: '2px', background: currentStep > 2 ? 'var(--success)' : 'var(--glass-border)', marginTop: '-20px' }}></div>
        <div className={`step-item ${currentStep >= 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <span className="step-label">Selesai</span>
        </div>
      </div>

      {/* Main Action Area */}
      <div className="card glass" style={{ padding: '2rem', minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {currentStep === 1 && (
          <>
            <div 
              className={`upload-zone ${isDragActive ? 'active' : ''}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              style={{ cursor: file ? 'default' : 'pointer' }}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
                disabled={loading}
              />
              
              <div className="upload-icon-container">
                {file ? <FileSpreadsheet size={40} className="text-success" /> : <UploadIcon size={40} className="text-primary" />}
              </div>
              
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                {file ? file.name : 'Pilih atau Tarik File Excel'}
              </h3>
              
              <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '450px', margin: '0 auto 1.5rem' }}>
                {file 
                  ? `Ukuran: ${(file.size / 1024).toFixed(2)} KB` 
                  : 'Dukungan format .xlsx dan .xls. Bewa akan mencari kolom Resi secara otomatis.'}
              </p>

              {file && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Ganti file lain
                </button>
              )}
            </div>

            {file && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={handleUpload}
                  style={{ height: '4rem', padding: '0 4rem', fontSize: '1.1rem', fontWeight: '700', borderRadius: '1.25rem', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)', background: 'var(--accent-gradient)' }}
                >
                  Mulai Proses Feedback <ArrowRight size={22} style={{ marginLeft: '0.75rem' }} />
                </button>
              </div>
            )}
          </>
        )}

        {currentStep === 2 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
              <Zap size={64} className="loading-spinner" style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 10px var(--glow))' }} />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1rem' }}>Menganalisa Data...</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '300px', margin: '0 auto' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                <span className="pulsing-dot"></span> Mencari kolom No. Waybill
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                <span className="pulsing-dot" style={{ animationDelay: '0.3s' }}></span> Menghitung umur logistik
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                <span className="pulsing-dot" style={{ animationDelay: '0.6s' }}></span> Menyuntikkan kolom Feedback Saya
              </p>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ 
              width: '100px', 
              height: '100px', 
              background: 'rgba(16, 185, 129, 0.1)', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 2rem',
              border: '2px solid var(--success)',
              color: 'var(--success)'
            }}>
              <CheckCircle size={56} />
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem' }}>Proses Selesai!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', marginBottom: '2.5rem' }}>
              File hasil analisa telah diunduh otomatis. Cek folder download Anda.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={resetProcess} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--glass-border)' }}>
                Upload File Lain
              </button>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                Kembali ke Menu
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions / Features Grid */}
      <div className="instruction-grid">
        <div className="instruction-card">
          <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}><Search size={24} /></div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Auto-Scan Kolom</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.6' }}>
            Tidak perlu urut. Bewa otomatis mendeteksi kolom dengan label 'AWB', 'Resi', atau 'Waybill' dimanapun posisinya.
          </p>
        </div>
        <div className="instruction-card">
          <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}><ShieldCheck size={24} /></div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Data Tetap Utuh</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.6' }}>
            Struktur file asli Anda tidak akan berubah. Bewa hanya menambahkan satu kolom 'feedback saya' di akhir baris.
          </p>
        </div>
        <div className="instruction-card">
          <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}><Info size={24} /></div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Analisa Historikal</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.6' }}>
            Untuk paket {'>'} 4 hari, sistem otomatis mencocokkan dengan catatan manual (history) yang ada di database Bewa.
          </p>
        </div>
      </div>
    </div>
  );
};
