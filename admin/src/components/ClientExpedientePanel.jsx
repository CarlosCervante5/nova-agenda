import { useState, useEffect } from 'react';
import api from '../api';
import { getStatusLabel, STATUS_OPTIONS } from '../utils/labels';
import { getRoleLabel } from '../utils/roles';
import { useAuth } from '../context/AuthContext';
import PasswordInput from './PasswordInput';
import {
  dedupeAppointments,
  formatAppointmentDateTime,
} from '../utils/appointmentDates';

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function buildWhatsAppUrl(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType) {
  if (mimeType === 'application/pdf') return 'picture_as_pdf';
  if (String(mimeType || '').startsWith('image/')) return 'image';
  return 'description';
}

function formatLogValue(value) {
  const text = String(value || '').trim();
  return text || '(vacío)';
}

export default function ClientExpedientePanel({
  clientId,
  selectedAppointment,
  canEditNotes = true,
  canEditProfile = true,
  canUploadFiles = true,
  canChangeStatus = true,
  canSendAccess = true,
  onStatusChange,
  onSchedule,
  onRefresh,
  onSelectAppointment,
  onSessionNotesSaved,
  embedded = false,
  variant = 'default',
  refreshKey = 0,
}) {
  const { isAdmin } = useAuth();
  const isAppointmentsView = variant === 'appointments';
  const showStats = !isAppointmentsView;
  const showFiles = !isAdmin && !isAppointmentsView;
  const showProfileChangeLog = !isAppointmentsView;
  const historyTitle = isAppointmentsView ? 'Historial de sesiones y notas' : 'Historial de sesiones';
  const [loading, setLoading] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingSessionNotes, setSavingSessionNotes] = useState(false);
  const [expediente, setExpediente] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [profileDraft, setProfileDraft] = useState({ name: '', email: '', phone: '', username: '', password: '' });
  const [sessionNotesDraft, setSessionNotesDraft] = useState('');
  const [profileLogs, setProfileLogs] = useState([]);
  const [message, setMessage] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingAccess, setSendingAccess] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setExpediente(null);
      return;
    }
    loadExpediente(clientId);
  }, [clientId, selectedAppointment?.id, selectedAppointment?.status, refreshKey]);

  useEffect(() => {
    if (!expediente?.client) {
      setSessionNotesDraft('');
      return;
    }

    const appointments = dedupeAppointments(expediente.appointments);
    const active = selectedAppointment?.client_id === expediente.client.id
      ? selectedAppointment
      : appointments[0];

    if (!active) {
      setSessionNotesDraft('');
      return;
    }

    const fromExpediente = appointments.find((apt) => apt.id === active.id);
    setSessionNotesDraft(fromExpediente?.notes ?? active.notes ?? '');
  }, [expediente, selectedAppointment?.id, selectedAppointment?.client_id]);

  const loadExpediente = async (id) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get(`/clients/${id}`);
      setExpediente({
        ...res.data,
        appointments: dedupeAppointments(res.data.appointments),
      });
      setNotesDraft(res.data.client?.notes || '');
      setProfileDraft({
        name: res.data.client?.name || '',
        email: res.data.client?.email || '',
        phone: res.data.client?.phone || '',
        username: res.data.client?.profile_username || '',
        password: '',
      });
      setProfileLogs(res.data.profile_logs || []);
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo cargar el expediente');
      setExpediente(null);
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!clientId) return;
    setSavingNotes(true);
    setMessage('');
    try {
      await api.put(`/clients/${clientId}`, { notes: notesDraft });
      setMessage('Expediente guardado');
      await loadExpediente(clientId);
      onRefresh?.();
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo guardar el expediente');
    } finally {
      setSavingNotes(false);
    }
  };

  const saveProfile = async () => {
    if (!clientId) return;
    if (!profileDraft.name.trim()) {
      setMessage('El nombre del paciente es obligatorio');
      return;
    }
    if (!profileDraft.email.trim() && !profileDraft.phone.trim()) {
      setMessage('Indica al menos un correo o teléfono');
      return;
    }

    if (!profileDraft.username.trim()) {
      setMessage('El usuario de acceso es obligatorio');
      return;
    }
    if (profileDraft.password.trim() && profileDraft.password.trim().length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSavingProfile(true);
    setMessage('');
    try {
      const payload = {
        name: profileDraft.name,
        email: profileDraft.email,
        phone: profileDraft.phone,
        username: profileDraft.username.trim(),
      };
      if (profileDraft.password.trim()) {
        payload.password = profileDraft.password;
      }

      const res = await api.put(`/clients/${clientId}`, payload);
      setMessage('Datos y acceso actualizados');
      if (res.data.profile_logs) {
        setProfileLogs(res.data.profile_logs);
      }
      setProfileDraft((prev) => ({ ...prev, password: '' }));
      await loadExpediente(clientId);
      onRefresh?.();
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo actualizar el perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const sendAccess = async () => {
    if (!clientId) return;

    const email = profileDraft.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Indica un correo válido del paciente antes de enviar los accesos');
      return;
    }

    if (!profileDraft.name.trim()) {
      setMessage('El nombre del paciente es obligatorio');
      return;
    }

    setSendingAccess(true);
    setMessage('');
    try {
      const client = expediente?.client;
      if (
        client
        && (
          profileDraft.name !== client.name
          || profileDraft.email !== client.email
          || profileDraft.phone !== client.phone
        )
      ) {
        await api.put(`/clients/${clientId}`, {
          name: profileDraft.name,
          email: profileDraft.email,
          phone: profileDraft.phone,
        });
      }

      const payload = {};
      if (profileDraft.username.trim()) {
        payload.username = profileDraft.username.trim();
      }
      if (profileDraft.password.trim()) {
        payload.password = profileDraft.password.trim();
      }

      const res = await api.post(`/clients/${clientId}/send-access`, payload);
      const sent = res.data.email?.sent;
      setMessage(sent ? `Accesos enviados a ${email}` : (res.data.message || 'No se pudo enviar el correo'));
      if (res.data.profile?.username) {
        setProfileDraft((prev) => ({
          ...prev,
          username: res.data.profile.username,
          password: '',
        }));
      }
      await loadExpediente(clientId);
      onRefresh?.();
    } catch (err) {
      setMessage(err.response?.data?.error || err.response?.data?.message || 'No se pudieron enviar los accesos');
    } finally {
      setSendingAccess(false);
    }
  };

  const saveSessionNotes = async () => {
    if (!expediente?.client) return;

    const appointments = expediente.appointments || [];
    const activeAppointment = selectedAppointment?.client_id === expediente.client.id
      ? selectedAppointment
      : appointments[0];

    if (!activeAppointment) return;

    setSavingSessionNotes(true);
    setMessage('');
    try {
      await api.put(`/appointments/${activeAppointment.id}`, { notes: sessionNotesDraft });
      setMessage('Notas de sesión guardadas');
      onSessionNotesSaved?.(activeAppointment.id, sessionNotesDraft);
      await loadExpediente(clientId);
      onRefresh?.();
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudieron guardar las notas de sesión');
    } finally {
      setSavingSessionNotes(false);
    }
  };

  const uploadFile = async (file) => {
    if (!clientId || !file) return;
    setUploadingFile(true);
    setMessage('');
    try {
      const data = new FormData();
      data.append('file', file);
      await api.post(`/clients/${clientId}/files`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage('Archivo subido correctamente');
      await loadExpediente(clientId);
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo subir el archivo');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      uploadFile(file);
    }
  };

  const downloadFile = async (file) => {
    try {
      const res = await api.get(`/clients/${clientId}/files/${file.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo descargar el archivo');
    }
  };

  const deleteFile = async (file) => {
    if (!confirm(`¿Eliminar "${file.original_name}" del expediente?`)) return;
    setMessage('');
    try {
      await api.delete(`/clients/${clientId}/files/${file.id}`);
      setMessage('Archivo eliminado');
      await loadExpediente(clientId);
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo eliminar el archivo');
    }
  };

  if (!clientId) {
    return (
      <div className={`client-expediente-panel client-expediente-panel--empty ${embedded ? 'client-expediente-panel--embedded' : ''}`}>
        <span className="material-symbols-outlined">folder_shared</span>
        <h3>Expediente del paciente</h3>
        <p>Selecciona una sesión de la lista para ver el detalle del cliente, su historial y agendar una nueva cita.</p>
      </div>
    );
  }

  if (loading && !expediente) {
    return (
      <div className={`client-expediente-panel client-expediente-panel--empty ${embedded ? 'client-expediente-panel--embedded' : ''}`}>
        <p>Cargando expediente...</p>
      </div>
    );
  }

  if (!expediente?.client) {
    return (
      <div className={`client-expediente-panel client-expediente-panel--empty ${embedded ? 'client-expediente-panel--embedded' : ''}`}>
        <p>{message || 'No se encontró el cliente'}</p>
      </div>
    );
  }

  const { client, stats = {}, files = [] } = expediente;
  const appointments = dedupeAppointments(expediente.appointments);
  const whatsappUrl = buildWhatsAppUrl(canEditProfile ? profileDraft.phone : client.phone);
  const activeAppointment = selectedAppointment?.client_id === client.id
    ? selectedAppointment
    : appointments[0];
  const hasClientProfile = !!client.has_profile;
  const canSendPatientAccess = canSendAccess && canEditProfile && canEditNotes && !hasClientProfile;
  const patientEmail = (canEditProfile ? profileDraft.email : client.email)?.trim() || '';

  return (
    <div className={`client-expediente-panel ${embedded ? 'client-expediente-panel--embedded' : ''}`}>
      <div className="client-expediente-header">
        <div className="client-expediente-avatar">{getInitials(client.name)}</div>
        <div>
          <h3>{client.name}</h3>
          <p>Expediente clínico</p>
        </div>
      </div>

      {message && (
        <div className={`client-expediente-message ${message.includes('No se') ? 'is-error' : 'is-success'}`}>
          {message}
        </div>
      )}

      {showStats && (
      <div className="client-expediente-stats">
        <div><strong>{stats.total || 0}</strong><span>Sesiones</span></div>
        <div><strong>{stats.upcoming || 0}</strong><span>Próximas</span></div>
        <div><strong>{stats.completed || 0}</strong><span>Completadas</span></div>
      </div>
      )}

      <div className="client-expediente-section">
        <div className="client-expediente-section-head">
          <h4>Datos del paciente y acceso</h4>
          {canEditProfile && canEditNotes && (
            <div className="client-expediente-section-actions">
              {canSendPatientAccess && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={sendAccess}
                  disabled={sendingAccess || !patientEmail}
                  title={!patientEmail ? 'Indica un correo válido del paciente' : undefined}
                >
                  {sendingAccess ? 'Enviando...' : 'Enviar accesos'}
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        {canEditProfile && canEditNotes ? (
          <div className="client-expediente-profile-form">
            <div className="form-group">
              <label>Nombre completo</label>
              <input
                type="text"
                value={profileDraft.name}
                onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Correo</label>
              <input
                type="email"
                value={profileDraft.email}
                onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Teléfono / WhatsApp</label>
              <input
                type="text"
                value={profileDraft.phone}
                onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })}
              />
            </div>
            <div className="client-expediente-access-fields">
              <div className="form-group">
                <label>Usuario de acceso</label>
                <input
                  type="text"
                  value={profileDraft.username}
                  onChange={(e) => setProfileDraft({ ...profileDraft, username: e.target.value })}
                  placeholder="Usuario para iniciar sesión"
                  required
                />
              </div>
              <div className="form-group">
                <label>Nueva contraseña</label>
                <PasswordInput
                  value={profileDraft.password}
                  onChange={(e) => setProfileDraft({ ...profileDraft, password: e.target.value })}
                  placeholder="Dejar vacío para no cambiar"
                />
              </div>
            </div>
            <p className="client-expediente-muted" style={{ marginTop: '4px' }}>
              Todos los clientes tienen acceso web. La contraseña inicial por defecto es cliente + ID (ej. cliente0005).
              {canSendPatientAccess && patientEmail && (
                <> Puedes enviar usuario y contraseña al correo del paciente con «Enviar accesos».</>
              )}
            </p>
          </div>
        ) : (
          <div className="client-expediente-contact-grid">
            {client.email && (
              <a href={`mailto:${client.email}`} className="client-expediente-tool">
                <span className="material-symbols-outlined">mail</span>
                {client.email}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="client-expediente-tool">
                <span className="material-symbols-outlined">call</span>
                {client.phone}
              </a>
            )}
          </div>
        )}

        {(profileDraft.email || profileDraft.phone || client.email || client.phone) && (
          <div className="client-expediente-contact-grid" style={{ marginTop: '12px' }}>
            {(profileDraft.email || client.email) && (
              <a href={`mailto:${profileDraft.email || client.email}`} className="client-expediente-tool">
                <span className="material-symbols-outlined">mail</span>
                Enviar correo
              </a>
            )}
            {(profileDraft.phone || client.phone) && (
              <a href={`tel:${profileDraft.phone || client.phone}`} className="client-expediente-tool">
                <span className="material-symbols-outlined">call</span>
                Llamar
              </a>
            )}
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="client-expediente-tool client-expediente-tool--whatsapp">
                <span className="material-symbols-outlined">chat</span>
                WhatsApp
              </a>
            )}
          </div>
        )}
      </div>

      {activeAppointment && (
        <>
        <div className="client-expediente-section">
          <h4>Sesión seleccionada</h4>
          <div className="client-expediente-session-card">
            <div className="client-expediente-session-top">
              <span
                className="client-expediente-service-pill"
                style={{
                  background: `${activeAppointment.service_color || '#7d7f3e'}15`,
                  color: activeAppointment.service_color || '#7d7f3e',
                }}
              >
                {activeAppointment.service_name}
              </span>
              {canChangeStatus && onStatusChange ? (
                <select
                  value={activeAppointment.status}
                  onChange={(e) => onStatusChange(activeAppointment.id, e.target.value)}
                  className={`status-pill ${activeAppointment.status}`}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <span className={`status-badge status-${activeAppointment.status}`}>
                  {getStatusLabel(activeAppointment.status)}
                </span>
              )}
            </div>
            <p>
              {formatAppointmentDateTime(activeAppointment.appointment_date, activeAppointment.appointment_time)}
            </p>
            {!isAppointmentsView && (
              <p className="client-expediente-muted" style={{ marginTop: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '4px' }}>person</span>
                Atiende: {activeAppointment.professional_name?.trim() || 'Sin asignar'}
              </p>
            )}
          </div>
        </div>

        {isAppointmentsView && (
          <div className="client-expediente-section">
            <h4>Profesional que lo atiende</h4>
            <div className="client-expediente-session-card">
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>badge</span>
                <strong>{activeAppointment.professional_name?.trim() || 'Sin profesional asignado'}</strong>
              </p>
            </div>
          </div>
        )}

        <div className={`client-expediente-section ${isAppointmentsView ? '' : 'client-expediente-session-notes-block'}`}>
          <div className="client-expediente-section-head">
            <h4>Notas de esta sesión</h4>
            {canEditNotes && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={saveSessionNotes}
                disabled={savingSessionNotes}
              >
                {savingSessionNotes ? 'Guardando...' : 'Guardar notas'}
              </button>
            )}
          </div>
          <textarea
            className="client-expediente-notes"
            value={sessionNotesDraft}
            onChange={(e) => setSessionNotesDraft(e.target.value)}
            readOnly={!canEditNotes}
            rows={4}
            placeholder="Evolución, tratamiento, observaciones de la sesión..."
          />
        </div>
        </>
      )}

      <div className="client-expediente-section">
        <div className="client-expediente-section-head">
          <h4>Notas generales del paciente</h4>
          {canEditNotes && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </div>
        <textarea
          className="client-expediente-notes"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          readOnly={!canEditNotes}
          rows={5}
          placeholder="Antecedentes, observaciones, preferencias del paciente..."
        />
      </div>

      {showFiles && (
      <div className="client-expediente-section">
        <div className="client-expediente-section-head">
          <h4>Archivos del expediente</h4>
          {canUploadFiles && canEditNotes && (
            <label className="btn btn-secondary btn-sm client-expediente-upload-btn">
              <span className="material-symbols-outlined">upload</span>
              {uploadingFile ? 'Subiendo...' : 'Subir archivo'}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
                onChange={handleFileChange}
                disabled={uploadingFile}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>
        <div className="client-expediente-files">
          {files.length === 0 ? (
            <p className="client-expediente-muted">Sin archivos adjuntos</p>
          ) : (
            files.map((file) => (
              <div key={file.id} className="client-expediente-file-item">
                <div className="client-expediente-file-info">
                  <span className="material-symbols-outlined">{getFileIcon(file.mime_type)}</span>
                  <div>
                    <strong>{file.original_name}</strong>
                    <span>
                      {formatFileSize(file.file_size)}
                      {' · '}
                      {new Date(file.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="client-expediente-file-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadFile(file)}>
                    Descargar
                  </button>
                  {canUploadFiles && canEditNotes && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => deleteFile(file)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      <div className="client-expediente-section">
        <div className="client-expediente-section-head">
          <h4>{historyTitle}</h4>
          {onSchedule && !isAppointmentsView && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onSchedule(client)}>
              <span className="material-symbols-outlined">event</span>
              Agendar cita
            </button>
          )}
        </div>
        <div className="client-expediente-history">
          {appointments.length === 0 ? (
            <p className="client-expediente-muted">Sin sesiones registradas</p>
          ) : (
            appointments.map(apt => (
              <button
                key={apt.id}
                type="button"
                className={`client-expediente-history-item ${activeAppointment?.id === apt.id ? 'is-active' : ''}`}
                onClick={() => onSelectAppointment?.(apt)}
              >
                <div className="client-expediente-history-main">
                  <div>
                    <strong>{apt.service_name}</strong>
                    <span>
                      {formatAppointmentDateTime(apt.appointment_date, apt.appointment_time)}
                      {apt.professional_name ? ` · ${apt.professional_name}` : ''}
                    </span>
                  </div>
                  <span className={`status-badge status-${apt.status}`}>{getStatusLabel(apt.status)}</span>
                </div>
                {apt.notes ? (
                  <p className="client-expediente-history-notes">{apt.notes}</p>
                ) : (
                  <p className="client-expediente-history-notes client-expediente-history-notes--empty">Sin notas registradas</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {showProfileChangeLog && (
      <div className="client-expediente-section">
        <h4>Historial de cambios del perfil</h4>
        <div className="client-expediente-change-log">
          {profileLogs.length === 0 ? (
            <p className="client-expediente-muted">Sin cambios registrados todavía</p>
          ) : (
            profileLogs.map((log) => (
              <div key={log.id} className="client-expediente-change-log-item">
                <div className="client-expediente-change-log-top">
                  <strong>{log.field_label}</strong>
                  <span>
                    {new Date(log.created_at).toLocaleString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p>
                  <span className="client-expediente-change-log-label">Antes:</span> {formatLogValue(log.old_value)}
                </p>
                <p>
                  <span className="client-expediente-change-log-label">Después:</span> {formatLogValue(log.new_value)}
                </p>
                <p className="client-expediente-change-log-meta">
                  {log.changed_by_name} · {getRoleLabel(log.changed_by_role)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
      )}
    </div>
  );
}
