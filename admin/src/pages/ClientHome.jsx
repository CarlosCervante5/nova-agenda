import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { getStatusLabel } from '../utils/labels';

export default function ClientHome() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/client/profile');
      setProfile(res.data);
    } finally {
      setLoading(false);
    }
  };

  const upcoming = (profile?.appointments || []).filter((apt) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return apt.appointment_date?.split('T')[0] >= today && apt.status !== 'cancelled';
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Hola, {user?.client_profile?.name || user?.full_name}</h1>
          <p className="subtitle">Consulta tus citas y mantén tu información de contacto actualizada.</p>
        </div>
      </div>

      {loading ? (
        <div className="card">Cargando tu perfil...</div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div>
                <div className="stat-label">Total de citas</div>
                <div className="stat-value">{profile?.stats?.total || 0}</div>
              </div>
              <div className="stat-icon primary">
                <span className="material-symbols-outlined">event</span>
              </div>
            </div>
            <div className="stat-card">
              <div>
                <div className="stat-label">Próximas</div>
                <div className="stat-value">{profile?.stats?.upcoming || 0}</div>
              </div>
              <div className="stat-icon secondary">
                <span className="material-symbols-outlined">schedule</span>
              </div>
            </div>
            <div className="stat-card">
              <div>
                <div className="stat-label">Completadas</div>
                <div className="stat-value">{profile?.stats?.completed || 0}</div>
              </div>
              <div className="stat-icon primary">
                <span className="material-symbols-outlined">task_alt</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '22px', marginBottom: '16px' }}>Próximas citas</h2>
            {upcoming.length === 0 ? (
              <p style={{ color: 'var(--on-surface-variant)' }}>No tienes citas próximas programadas.</p>
            ) : (
              upcoming.map((apt) => (
                <div key={apt.id} className="appointment-item">
                  <div
                    className="appointment-avatar"
                    style={{ background: `${apt.service_color || '#7d7f3e'}20`, color: apt.service_color || '#7d7f3e' }}
                  >
                    <span className="material-symbols-outlined">spa</span>
                  </div>
                  <div className="appointment-info">
                    <h4>{apt.service_name}</h4>
                    <p>
                      {format(parseISO(apt.appointment_date.split('T')[0]), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                      {' · '}
                      {(apt.appointment_time || '').slice(0, 5)}
                    </p>
                  </div>
                  <span className={`status-badge status-${apt.status}`}>{getStatusLabel(apt.status)}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
