import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Appointments from './pages/Appointments';
import Clients from './pages/Clients';
import Services from './pages/Services';
import SharingTools from './pages/SharingTools';
import ClientProfilePage from './pages/ClientProfilePage';
import ProfessionalProfilePage from './pages/ProfessionalProfilePage';
import ClientAppointments from './pages/ClientAppointments';
import Settings from './pages/Settings';
import Professionals from './pages/Professionals';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;
  }

  return user ? children : <Navigate to="/login" />;
}

function StaffRoute({ children }) {
  const { user, loading, isCliente } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (isCliente) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ProfesionalOnlyRoute({ children }) {
  const { user, loading, isProfesional, isAdmin } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!isProfesional || isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ClientOnlyRoute({ children }) {
  const { user, loading, isCliente } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!isCliente) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;
  }

  return user ? <Navigate to="/" /> : children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/booking/admin-dist">
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />

          <Route path="/" element={
            <PrivateRoute>
              <Layout><Dashboard /></Layout>
            </PrivateRoute>
          } />

          <Route path="/appointments" element={
            <StaffRoute>
              <Layout><Appointments /></Layout>
            </StaffRoute>
          } />

          <Route path="/my-appointments" element={
            <ClientOnlyRoute>
              <Layout><ClientAppointments /></Layout>
            </ClientOnlyRoute>
          } />

          <Route path="/profile" element={
            <ClientOnlyRoute>
              <Layout><ClientProfilePage /></Layout>
            </ClientOnlyRoute>
          } />

          <Route path="/my-profile" element={
            <ProfesionalOnlyRoute>
              <Layout><ProfessionalProfilePage /></Layout>
            </ProfesionalOnlyRoute>
          } />

          <Route path="/clients" element={
            <AdminRoute>
              <Layout><Clients /></Layout>
            </AdminRoute>
          } />

          <Route path="/services" element={
            <AdminRoute>
              <Layout><Services /></Layout>
            </AdminRoute>
          } />

          <Route path="/calendar" element={
            <StaffRoute>
              <Layout><Calendar /></Layout>
            </StaffRoute>
          } />

          <Route path="/professionals" element={
            <AdminRoute>
              <Layout><Professionals /></Layout>
            </AdminRoute>
          } />

          <Route path="/sharing" element={
            <AdminRoute>
              <Layout><SharingTools /></Layout>
            </AdminRoute>
          } />

          <Route path="/settings" element={
            <AdminRoute>
              <Layout><Settings /></Layout>
            </AdminRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
