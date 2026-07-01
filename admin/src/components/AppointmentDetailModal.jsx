import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getStatusLabel, STATUS_OPTIONS } from '../utils/labels';
import api from '../api';

function formatTime(time) {
  if (!time) return '';
  const [hours, minutes = '00'] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHours = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHours}:${minutes.slice(0, 2)} ${ampm}`;
}

function getEndTime(startTime, durationMinutes = 60) {
  if (!startTime) return '';
  const [hours, minutes = '0'] = startTime.split(':');
  let h = parseInt(hours, 10);
  let m = parseInt(minutes, 10) + durationMinutes;
  h += Math.floor(m / 60);
  m %= 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHours = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHours}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function AppointmentDetailModal({
  appointment,
  onClose,
  onStatusChange,
  readOnly = false,
  allowCreateProfile = false,
  onProfileCreated,
}) {
  const [sendingAccess, setSendingAccess] = useState(false);
  const [profileInfo, setProfileInfo] = useState(null);

  if (!appointment) return null;

  const dateValue = appointment.appointment_date?.split('T')[0];
  const formattedDate = dateValue
    ? format(parseISO(dateValue), "EEEE d 'de' MMMM, yyyy", { locale: es })
    : '';
  const hasClientProfile = !!(appointment.client_user_id || profileInfo?.username);
  const clientEmail = appointment.client_email?.trim() || '';
  const canSendAccess = allowCreateProfile
    && appointment.client_id
    && !hasClientProfile
    && clientEmail !== '';

  const handleSendAccess = async () => {
    if (!canSendAccess) return;

    setSendingAccess(true);
    try {
      const res = await api.post(`/clients/${appointment.client_id}/send-access`, {});
      const profile = res.data.profile || {};
      setProfileInfo(profile);
      if (onProfileCreated) {
        onProfileCreated(profile);
      }
      if (res.data.email?.sent) {
        alert(`Accesos enviados a ${clientEmail}.\nUsuario: ${profile.username}`);
      } else {
        alert(res.data.message || 'No se pudo enviar el correo con los accesos');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'No se pudieron enviar los accesos al paciente');
    } finally {
      setSendingAccess(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal appointment-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="appointment-detail-modal-header">
          <h2>Detalle de la cita</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="appointment-detail-modal-body">
          <div
            className="appointment-detail-hero"
            style={{
              borderColor: `${appointment.service_color || '#7d7f3e'}40`,
              background: `${appointment.service_color || '#7d7f3e'}10`,
            }}
          >
            <div
              className="appointment-avatar"
              style={{
                background: `${appointment.service_color || '#7d7f3e'}20`,
                color: appointment.service_color || '#7d7f3e',
              }}
            >
              {(appointment.client_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3>{appointment.client_name}</h3>
              <p>{appointment.service_name}</p>
            </div>
          </div>

          <div className="appointment-detail-grid">
            <div className="appointment-detail-field">
              <span className="material-symbols-outlined">calendar_today</span>
              <div>
                <span className="appointment-detail-label">Fecha</span>
                <span className="appointment-detail-value">{formattedDate}</span>
              </div>
            </div>

            <div className="appointment-detail-field">
              <span className="material-symbols-outlined">schedule</span>
              <div>
                <span className="appointment-detail-label">Horario</span>
                <span className="appointment-detail-value">
                  {formatTime(appointment.appointment_time)} – {getEndTime(appointment.appointment_time, appointment.duration_minutes)}
                </span>
              </div>
            </div>

            <div className="appointment-detail-field">
              <span className="material-symbols-outlined">person</span>
              <div>
                <span className="appointment-detail-label">Profesional</span>
                <span className="appointment-detail-value">
                  {appointment.professional_name?.trim() || 'Sin asignar'}
                </span>
              </div>
            </div>

            <div className="appointment-detail-field">
              <span className="material-symbols-outlined">flag</span>
              <div>
                <span className="appointment-detail-label">Estado</span>
                {readOnly || !onStatusChange ? (
                  <span className={`status-badge status-${appointment.status}`}>
                    {getStatusLabel(appointment.status)}
                  </span>
                ) : (
                  <select
                    value={appointment.status}
                    onChange={(e) => onStatusChange(appointment.id, e.target.value)}
                    className={`status-pill ${appointment.status}`}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {appointment.client_email && (
              <div className="appointment-detail-field">
                <span className="material-symbols-outlined">mail</span>
                <div>
                  <span className="appointment-detail-label">Correo</span>
                  <a className="appointment-detail-value" href={`mailto:${appointment.client_email}`}>
                    {appointment.client_email}
                  </a>
                </div>
              </div>
            )}

            {appointment.client_phone && (
              <div className="appointment-detail-field">
                <span className="material-symbols-outlined">call</span>
                <div>
                  <span className="appointment-detail-label">Teléfono</span>
                  <a className="appointment-detail-value" href={`tel:${appointment.client_phone}`}>
                    {appointment.client_phone}
                  </a>
                </div>
              </div>
            )}

            {(hasClientProfile || profileInfo?.username) && (
              <div className="appointment-detail-field appointment-detail-field--full">
                <span className="material-symbols-outlined">account_circle</span>
                <div>
                  <span className="appointment-detail-label">Acceso del paciente</span>
                  <span className="appointment-detail-value">
                    Usuario: {profileInfo?.username || 'Cuenta activa'}
                  </span>
                </div>
              </div>
            )}

            {appointment.notes && (
              <div className="appointment-detail-field appointment-detail-field--full">
                <span className="material-symbols-outlined">notes</span>
                <div>
                  <span className="appointment-detail-label">Notas</span>
                  <p className="appointment-detail-notes">{appointment.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          {allowCreateProfile && !hasClientProfile && appointment.client_id && !clientEmail && (
            <p className="appointment-detail-hint">
              Añade un correo al paciente para poder enviarle sus accesos.
            </p>
          )}
          {canSendAccess && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSendAccess}
              disabled={sendingAccess}
            >
              {sendingAccess ? 'Enviando accesos...' : 'Enviar accesos al paciente'}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
