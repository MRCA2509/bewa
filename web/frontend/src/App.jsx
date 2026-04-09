import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { ActiveShipments } from './pages/ActiveShipments';
import { AgingReport } from './pages/AgingReport';
import { MonitoringReport } from './pages/MonitoringReport';
import { Tracking } from './pages/Tracking';
import { UploadData } from './pages/UploadData';
import { DailyProgressReport } from './pages/DailyProgressReport';
import { HistoryShipments } from './pages/HistoryShipments';
import { AutoFeedback } from './pages/AutoFeedback';
import { UploadPod } from './pages/UploadPod';
import { UserManagement } from './pages/UserManagement';
import { SprinterReport } from './pages/SprinterReport';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" replace />;
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="upload" element={<UploadData />} />
            <Route path="active-shipments" element={<ActiveShipments />} />
            <Route path="aging-report" element={<AgingReport />} />
            <Route path="history-shipments" element={<HistoryShipments />} />
            <Route path="monitoring" element={<MonitoringReport />} />
            <Route path="daily-progress" element={<DailyProgressReport />} />
            <Route path="tracking" element={<Tracking />} />
            <Route path="auto-feedback" element={<AutoFeedback />} />
            <Route path="sprinter-report" element={<SprinterReport />} />
            <Route path="upload-pod" element={<UploadPod />} />
            <Route path="users" element={<ProtectedRoute requiredRole="RM"><UserManagement /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
