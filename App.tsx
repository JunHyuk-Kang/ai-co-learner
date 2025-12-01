import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BotProvider } from './contexts/BotContext';
import { Layout } from './components/layout/Layout';
import { Role } from './types';
import { configureAmplify } from './aws-config';

configureAmplify();

// Lazy load page components
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const ChatRoom = lazy(() => import('./pages/ChatRoom').then(module => ({ default: module.ChatRoom })));
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(module => ({ default: module.AdminPanel })));

// Loading component
const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    Loading...
  </div>
);

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
    <Suspense fallback={<LoadingFallback />}>
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
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BotProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </BotProvider>
    </AuthProvider>
  );
};

export default App;