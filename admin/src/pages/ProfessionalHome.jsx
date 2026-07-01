import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { getStatusLabel } from '../utils/labels';
import AppointmentDetailModal from '../components/AppointmentDetailModal';
import { dedupeAppointments, formatAppointmentDate, getAppointmentDateKey } from '../utils/appointmentDates';

export default function ProfessionalHome() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const services = user?.services || [];

  useEffect(() => {
    loadAppointments();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get('/appointments/stats');
      setStats(res.data);
    } catch {
      setStats(null);
    }
  };

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const res = await api.get(`/appointments?dateFrom=${today}`);
      const sorted = dedupeAppointments(res.data).sort((a, b) => {
        const dateCompare = getAppointmentDateKey(a.appointment_date).localeCompare(getAppointmentDateKey(b.appointment_date));
        if (dateCompare !== 0) return dateCompare;
        return (a.appointment_time || '').localeCompare(b.appointment_time || '');
      });
      setAppointments(sorted);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const getServiceColor = (service) => service.color || '#7d7f3e';

  const bookingLink = user?.booking_url || (user?.id ? `${window.location.origin}/booking/public/?professional=${user.id}` : '');

  const copyBookingLink = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <p style={{
            fontSize: '12px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--on-surface-variant)',
            marginBottom: '8px',
          }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h1>Hola, {user?.full_name || user?.username}</h1>
          <p className="subtitle">Aquí puedes ver tus servicios asignados y las sesiones agendadas.</p>
        </div>
      </div>

      {bookingLink && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", marginBottom: '8px' }}>Tu enlace de booking</h3>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '12px' }}>
            Comparte este enlace para que tus clientes vean tu foto y reserven solo tus servicios.
          </p>
          <div className="url-input-group">
            <input type="text" className="url-input" value={bookingLink} readOnly />
            <button type="button" className="copy-btn" onClick={copyBookingLink}>
              <span className="material-symbols-outlined">content_copy</span>
            </button>
          </div>
        </div>
      )}

      <div className="stats-grid dashboard-kpis" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Citas agendadas</div>
            <div className="stat-value">{stats?.scheduled ?? 0}</div>
            <div className="stat-change neutral">
              {stats?.pending ?? 0} pendientes
            </div>
          </div>
          <div className="stat-icon primary">
            <span className="material-symbols-outlined">event_available</span>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Canceladas</div>
            <div className="stat-value">{stats?.cancelled ?? 0}</div>
            <div className="stat-change neutral">
              {stats?.completed ?? 0} completadas
            </div>
          </div>
          <div className="stat-icon secondary">
            <span className="material-symbols-outlined">event_busy</span>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Mis pacientes</div>
            <div className="stat-value">{stats?.totalClients ?? 0}</div>
            <div className="stat-change neutral">
              Clientes con sesiones
            </div>
          </div>
          <div className="stat-icon tertiary">
            <span className="material-symbols-outlined">group</span>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Citas hoy</div>
            <div className="stat-value">{String(stats?.today ?? 0).padStart(2, '0')}</div>
            <div className="stat-change neutral">
              {stats?.thisWeek ?? 0} esta semana
            </div>
          </div>
          <div className="stat-icon primary">
            <span className="material-symbols-outlined">today</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '22px', marginBottom: '16px' }}>Mis servicios</h2>
        {services.length === 0 ? (
          <p style={{ color: 'var(--on-surface-variant)' }}>Aún no tienes servicios asignados. Contacta al administrador.</p>
        ) : (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {services.map(service => {
              const color = getServiceColor(service);
              return (
                <div key={service.id} className="card" style={{ borderTop: `4px solid ${color}`, padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '0.75rem',
                      background: `${color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span className="material-symbols-outlined" style={{ color }}>spa</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{service.name}</div>
                      {service.category_name && (
                        <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{service.category_name}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '22px', marginBottom: '16px' }}>Mis sesiones agendadas</h2>
        {loading ? (
          <p style={{ color: 'var(--on-surface-variant)' }}>Cargando citas...</p>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.3, display: 'block', marginBottom: '12px' }}>event_busy</span>
            No tienes sesiones próximas programadas
          </div>
        ) : (
          appointments.map(apt => (
            <div
              key={apt.id}
              className="appointment-item"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedAppointment(apt)}
            >
              <div
                className="appointment-avatar"
                style={{ background: `${apt.service_color || '#7d7f3e'}20`, color: apt.service_color || '#7d7f3e' }}
              >
                {getInitials(apt.client_name)}
              </div>
              <div className="appointment-info">
                <h4>{apt.client_name}</h4>
                <p>
                  <span style={{
                    padding: '2px 8px',
                    background: `${apt.service_color || '#7d7f3e'}15`,
                    color: apt.service_color || '#7d7f3e',
                    borderRadius: '1rem',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}>
                    {apt.service_name}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
                    {formatAppointmentDate(apt.appointment_date)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span>
                    {apt.appointment_time.slice(0, 5)}
                  </span>
                </p>
              </div>
              <span className={`status-badge status-${apt.status}`}>
                {getStatusLabel(apt.status)}
              </span>
            </div>
          ))
        )}
      </div>

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={async (id, status) => {
            await api.put(`/appointments/${id}`, { status });
            setSelectedAppointment({ ...selectedAppointment, status });
            loadAppointments();
            loadStats();
          }}
          allowCreateProfile
          onProfileCreated={(profile) => {
            setSelectedAppointment({
              ...selectedAppointment,
              client_user_id: profile.user_id,
            });
          }}
        />
      )}
    </div>
  );
}
