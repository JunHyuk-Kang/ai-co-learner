import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ChatRoom } from './pages/ChatRoom';
import { AdminPanel } from './pages/AdminPanel';
import { Role } from './types';
import { configureAmplify } from './aws-config';

configureAmplify();

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

// Admin Route Wrapper
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user || user.role !== Role.ADMIN) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/chat/:agentId" element={
        <ProtectedRoute>
          <ChatRoom />
        </ProtectedRoute>
      } />
      
      <Route path="/admin" element={
        <AdminRoute>
          <AdminPanel />
        </AdminRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;