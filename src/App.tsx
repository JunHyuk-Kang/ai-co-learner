import React, { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BotProvider } from './contexts/BotContext';
import { Layout } from './components/layout/Layout';
import { PageTransition } from './components/layout/PageTransition';
import { Role } from './types';
import { configureAmplify } from './aws-config';

configureAmplify();

const queryClient = new QueryClient();

// Lazy load page components
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const ChatRoom = lazy(() => import('./pages/ChatRoom').then(module => ({ default: module.ChatRoom })));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase').then(module => ({ default: module.KnowledgeBase })));
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(module => ({ default: module.AdminPanel })));
const InitialAssessment = lazy(() => import('./pages/InitialAssessment').then(module => ({ default: module.InitialAssessment })));
const DailyQuests = lazy(() => import('./pages/DailyQuests'));

// Loading component
const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    Loading...
  </div>
);

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  // 로딩 중에는 스플래시 화면 표시
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

// Admin Route Wrapper
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  // 로딩 중에는 스플래시 화면 표시
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== Role.ADMIN) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  const location = useLocation();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />

          <Route path="/" element={
            <ProtectedRoute>
              <PageTransition>
                <Dashboard />
              </PageTransition>
            </ProtectedRoute>
          } />

          <Route path="/chat/:agentId" element={
            <ProtectedRoute>
              <PageTransition>
                <ChatRoom />
              </PageTransition>
            </ProtectedRoute>
          } />

          <Route path="/knowledge-base" element={
            <ProtectedRoute>
              <PageTransition>
                <KnowledgeBase />
              </PageTransition>
            </ProtectedRoute>
          } />

          <Route path="/assessment" element={
            <ProtectedRoute>
              <PageTransition>
                <InitialAssessment />
              </PageTransition>
            </ProtectedRoute>
          } />

          <Route path="/quests" element={
            <ProtectedRoute>
              <PageTransition>
                <DailyQuests />
              </PageTransition>
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <AdminRoute>
              <PageTransition>
                <AdminPanel />
              </PageTransition>
            </AdminRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BotProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </BotProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;