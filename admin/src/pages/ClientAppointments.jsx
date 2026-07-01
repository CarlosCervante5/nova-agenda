import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../api';
import { getStatusLabel } from '../utils/labels';

export default function ClientAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments');
      setAppointments(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mis citas</h1>
          <p className="subtitle">Historial completo de tus sesiones en Tapai.</p>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--on-surface-variant)' }}>Cargando citas...</p>
        ) : appointments.length === 0 ? (
          <p style={{ color: 'var(--on-surface-variant)' }}>Aún no tienes citas registradas.</p>
        ) : (
          appointments.map((apt) => (
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
                {apt.professional_name && (
                  <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                    Profesional: {apt.professional_name}
                  </p>
                )}
                {apt.notes?.trim() && (
                  <p className="client-expediente-history-notes" style={{ marginTop: '8px' }}>
                    {apt.notes}
                  </p>
                )}
              </div>
              <span className={`status-badge status-${apt.status}`}>{getStatusLabel(apt.status)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
