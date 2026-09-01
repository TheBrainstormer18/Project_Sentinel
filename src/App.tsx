import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { EarlyWarnings } from './pages/EarlyWarnings';
import { ModelInsights } from './pages/ModelInsights';
import { DataUpload } from './pages/DataUpload';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { fetchDashboard } from './services/api';

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [highRiskCount, setHighRiskCount] = useState<number>(0);
  const [newAlertCount, setNewAlertCount] = useState<number>(0);
  const { isAuthenticated } = useAuth();

  const loadSummaryStats = async () => {
    if (!isAuthenticated) return;
    try {
      const summary = await fetchDashboard();
      setHighRiskCount(summary.high_risk_projects);
      const newAlerts = (summary.recent_alerts || []).filter((a) => a.status === 'NEW').length;
      setNewAlertCount(newAlerts);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSummaryStats();
    const interval = setInterval(loadSummaryStats, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Main Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        highRiskCount={highRiskCount}
        newAlertCount={newAlertCount}
      />

      {/* Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          highRiskCount={highRiskCount}
          newAlertCount={newAlertCount}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Projects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute>
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <EarlyWarnings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/model-insights"
              element={
                <ProtectedRoute>
                  <ModelInsights />
                </ProtectedRoute>
              }
            />
            {/* RBAC: Only Admin can access Data Upload */}
            <Route
              path="/upload"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DataUpload />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
