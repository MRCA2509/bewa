import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './Sidebar';

export const Layout = () => {
  const [isMini, setIsMini] = useState(false);

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--glass-bg)',
            color: 'var(--text-main)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(12px)',
          },
          success: {
            iconTheme: {
              primary: 'var(--success)',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--danger)',
              secondary: '#fff',
            },
          },
        }}
      />
      <Sidebar isMini={isMini} setIsMini={setIsMini} />
      <main className={`main-content ${isMini ? 'pushed' : ''}`}>
        <Outlet />
      </main>
    </>
  );
};
