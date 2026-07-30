import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MapPage from './pages/MapPage';
import ReportPage from './pages/ReportPage';
import OfflineSuccessPage from './pages/OfflineSuccessPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ResourceEditPage from './pages/ResourceEditPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/offline-success" element={<OfflineSuccessPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/resources/:id" element={<ResourceEditPage />} />
      </Routes>
    </Router>
  );
}
