import React, { lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MapPage from './pages/MapPage';
const ReportPage = lazy(() => import('./pages/ReportPage'));
const OfflineSuccessPage = lazy(() => import('./pages/OfflineSuccessPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const ResourceEditPage = lazy(() => import('./pages/ResourceEditPage'));

export default function App() {
  return (
    <Router>
      <Suspense fallback={<p role="status" className="p-6">Opening Lifeline…</p>}><Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/offline-success" element={<OfflineSuccessPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/resources/:id" element={<ResourceEditPage />} />
      </Routes></Suspense>
    </Router>
  );
}
