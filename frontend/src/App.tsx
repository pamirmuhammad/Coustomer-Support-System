import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import './App.css';

const SignIn = lazy(() => import('./pages/SignIn'));
const SignUp = lazy(() => import('./pages/SignUp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ServiceManagement = lazy(() => import('./pages/ServiceManagement'));
const OrganizationManagement = lazy(() => import('./pages/OrganizationManagement'));
const TicketManagement = lazy(() => import('./pages/TicketManagement'));
const SupportDashboard = lazy(() => import('./pages/SupportDashboard'));
const MyAssignTicket = lazy(() => import('./pages/MyAssignTicket'));
const OrganizationDashboard = lazy(() => import('./pages/OrganizationDashboard'));
const MyTickets = lazy(() => import('./pages/MyTickets'));
const Reports = lazy(() => import('./pages/Reports'));
const CreateRole = lazy(() => import('./pages/CreateRole'));
const CreateUser = lazy(() => import('./pages/CreateUser'));
const AdminMyTickets = lazy(() => import('./pages/AdminMyTickets'));
const ForcePasswordChange = lazy(() => import('./pages/ForcePasswordChange'));

// Route guard component – redirects unauthenticated users to /signin and unauthorized users to /unauthorized
function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
            <div className="h-8 w-48 rounded animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
          </div>
          <div className="flex gap-4 min-h-0 flex-col lg:flex-row">
            <div className="flex-1">
              <div className="flex gap-3 w-full flex-wrap lg:flex-nowrap mb-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex-1 bg-white rounded-xl shadow-md border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                      <div className="h-4 w-16 rounded animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                    </div>
                    <div className="h-8 w-20 rounded animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 min-h-0 flex-col lg:flex-row">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col flex-1" style={{ height: '460px' }}>
                  <div className="flex items-center gap-3 px-6 py-4">
                    <div className="w-10 h-10 rounded-lg animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                    <div className="h-6 w-40 rounded animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                  </div>
                  <div className="flex-1 p-6 animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%', minHeight: '280px'}}></div>
                </div>
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col flex-1" style={{ height: '460px' }}>
                  <div className="flex items-center gap-3 px-6 py-4">
                    <div className="w-10 h-10 rounded-lg animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                    <div className="h-6 w-40 rounded animate-shimmer" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                  </div>
                  <div className="flex-1 p-6">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-12 rounded-lg animate-shimmer mb-3" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
      return <Navigate to="/signin" />;
  }

  if (user?.passwordChangeRequired && window.location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" />;
  }

  if (allowedRoles) {
    // Check if user's role matches any allowed role
    // For SUPPORT, any role containing "SUPPORT" or any custom role is allowed
    const hasAccess = allowedRoles.some(allowedRole => {
      if (allowedRole === 'SUPPORT') {
        // Allow any role for support routes (treat custom roles as support users)
        return user?.role?.includes('SUPPORT') || user?.role;
      }
      return user?.role === allowedRole;
    });

    if (!hasAccess) {
          return <Navigate to="/unauthorized" />;
    }
  }

  return <Layout>{children}</Layout>;
}

// Redirects authenticated users to their role-specific dashboard (ADMIN, ORGANIZATION/USER, or SUPPORT)
function RoleBasedDashboard() {
  const { user } = useAuth();


  if (user?.role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" />;
  } else if (user?.role === 'ORGANIZATION' || user?.role === 'USER') {
      return <Navigate to="/org/dashboard" />;
  } else if (user?.role?.includes('SUPPORT') || user?.role) {
    // Any role containing SUPPORT, or any other role (treat as support user for custom roles)
      return <Navigate to="/support/dashboard" />;
  }

  return <Navigate to="/signin" />;
}

// Root application component – sets up NotificationProvider, AuthProvider, Router, ErrorBoundary, Suspense, and all routes
function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <ErrorBoundary>
            <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6"><div className="w-full max-w-7xl mx-auto"><div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 rounded-xl" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div><div className="h-8 w-48 rounded" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div></div><div className="flex gap-4 min-h-0 flex-col lg:flex-row"><div className="flex-1"><div className="flex gap-3 w-full flex-wrap lg:flex-nowrap mb-4">{[1,2,3,4].map(i=><div key={i} className="flex-1 bg-white rounded-xl shadow-md border border-gray-100 p-4"><div className="flex items-center justify-between mb-3"><div className="w-10 h-10 rounded-lg" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div><div className="h-4 w-16 rounded" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div></div><div className="h-8 w-20 rounded" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div></div>)}</div><div className="flex gap-4 min-h-0 flex-col lg:flex-row"><div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col flex-1" style={{height:'460px'}}><div className="flex items-center gap-3 px-6 py-4"><div className="w-10 h-10 rounded-lg" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div><div className="h-6 w-40 rounded" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div></div><div className="flex-1 p-6" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%', minHeight:'280px'}}></div></div><div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col flex-1" style={{height:'460px'}}><div className="flex items-center gap-3 px-6 py-4"><div className="w-10 h-10 rounded-lg" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div><div className="h-6 w-40 rounded" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div></div><div className="flex-1 p-6">{[1,2,3,4,5].map(i=><div key={i} className="h-12 rounded-lg mb-3" style={{background: 'linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%)', backgroundSize: '1000px 100%'}}></div>)}</div></div></div></div></div></div></div>}>
            <Routes>
            {/* Public Routes */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/force-password-change" element={<ForcePasswordChange />} />
            
            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </PrivateRoute>
            } />
            <Route path="/admin/services" element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <ServiceManagement />
              </PrivateRoute>
            } />
            <Route path="/admin/organizations" element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <OrganizationManagement />
              </PrivateRoute>
            } />
            <Route path="/admin/tickets" element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <TicketManagement />
              </PrivateRoute>
            } />
            <Route path="/admin/my-tickets" element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <AdminMyTickets />
              </PrivateRoute>
            } />
            <Route path="/admin/reports" element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <Reports />
              </PrivateRoute>
            } />
            <Route path="/admin/create-role" element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <CreateRole />
              </PrivateRoute>
            } />
            <Route path="/admin/create-user" element={
              <PrivateRoute allowedRoles={['ADMIN']}>
                <CreateUser />
              </PrivateRoute>
            } />
            
            {/* Support Routes */}
            <Route path="/support/dashboard" element={
              <PrivateRoute allowedRoles={['ADMIN', 'SUPPORT']}>
                <SupportDashboard />
              </PrivateRoute>
            } />
            <Route path="/support/my-tickets" element={
              <PrivateRoute allowedRoles={['ADMIN', 'SUPPORT']}>
                <MyAssignTicket />
              </PrivateRoute>
            } />
            
            {/* Organization Routes */}
            <Route path="/org/dashboard" element={
              <PrivateRoute allowedRoles={['ORGANIZATION', 'USER']}>
                <OrganizationDashboard />
              </PrivateRoute>
            } />
            <Route path="/org/tickets" element={
              <PrivateRoute allowedRoles={['ORGANIZATION', 'USER']}>
                <MyTickets />
              </PrivateRoute>
            } />
            
            {/* Default Routes */}
            <Route path="/dashboard" element={<RoleBasedDashboard />} />
            <Route path="/" element={<Navigate to="/signin" />} />
            <Route path="*" element={<Navigate to="/signin" />} />
          </Routes>
            </Suspense>
            </ErrorBoundary>
        </div>
      </Router>
    </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
