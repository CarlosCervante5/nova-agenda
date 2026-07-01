import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { format } from 'date-fns';
import { getStatusLabel, STATUS_OPTIONS } from '../utils/labels';
import { useAuth } from '../context/AuthContext';
import ClientExpedientePanel from '../components/ClientExpedientePanel';
import {
  dedupeAppointments,
  formatAppointmentDate,
  getAppointmentDateKey,
} from '../utils/appointmentDates';

export default function Appointments() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [filters, setFilters] = useState({
    date: '',
    status: '',
    dateField: 'appointment',
    sortBy: 'appointment',
  });
  const [newClientMode, setNewClientMode] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    service_id: '',
    professional_id: '',
    appointment_date: format(new Date(), 'yyyy-MM-dd'),
    appointment_time: '09:00',
    notes: '',
  });
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [expedienteRefreshKey, setExpedienteRefreshKey] = useState(0);

  useEffect(() => {
    loadAppointments();
    loadServices();
    loadClients();
    if (isAdmin) {
      loadProfessionals();
    }
  }, [filters]);

  const loadAppointments = async () => {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.status) params.append('status', filters.status);
    if (filters.dateField === 'created') params.append('date_field', 'created');
    if (filters.sortBy === 'created') params.append('sort_by', 'created');
    const res = await api.get(`/appointments?${params}`);
    setAppointments(dedupeAppointments(res.data));
  };

  const formatRegistrationDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadServices = async () => {
    const res = await api.get('/services');
    setServices(res.data);
  };

  const loadClients = async () => {
    try {
      const res = await api.get('/clients');
      setClients(res.data);
    } catch {
      setClients([]);
    }
  };

  const loadProfessionals = async () => {
    try {
      const res = await api.get('/users/professionals');
      setProfessionals((res.data || []).filter(p => p.active));
    } catch {
      setProfessionals([]);
    }
  };

  const getProfessionalsForService = (serviceId) => {
    if (!serviceId) return professionals;
    const id = parseInt(serviceId, 10);
    return professionals.filter(p => (p.service_ids || []).includes(id));
  };

  const openScheduleModal = (client = null) => {
    resetForm();
    if (client) {
      setFormData(prev => ({ ...prev, client_id: String(client.id) }));
      setNewClientMode(false);
    }
    setEditingAppointment(null);
    setShowScheduleModal(true);
  };

  useEffect(() => {
    const scheduleClientId = location.state?.scheduleClientId;
    if (!scheduleClientId) return;

    setSelectedClientId(Number(scheduleClientId));
    openScheduleModal({ id: scheduleClientId });
    window.history.replaceState({}, document.title);
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const service = services.find(s => s.id === parseInt(formData.service_id, 10));
    let clientId = formData.client_id;

    try {
      if (newClientMode) {
        if (!newClientData.email.trim() && !newClientData.phone.trim()) {
          alert('Indica al menos un correo o teléfono para el paciente nuevo.');
          return;
        }
        const created = await api.post('/clients', newClientData);
        clientId = created.data.id;
      }

      const payload = {
        ...formData,
        client_id: clientId,
        duration_minutes: service?.duration_minutes || 60,
      };

      if (isAdmin && formData.professional_id) {
        payload.professional_id = parseInt(formData.professional_id, 10);
      } else if (isAdmin) {
        payload.professional_id = null;
      }

      if (editingAppointment) {
        await api.put(`/appointments/${editingAppointment.id}`, payload);
      } else {
        await api.post('/appointments', payload);
      }

      setShowScheduleModal(false);
      setEditingAppointment(null);
      resetForm();
      await loadAppointments();
      await loadClients();
      setExpedienteRefreshKey((key) => key + 1);
      if (selectedAppointment?.client_id && Number(selectedAppointment.client_id) === Number(clientId)) {
        setShowDetailModal(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo guardar la cita');
    }
  };

  const handleEdit = (apt) => {
    setEditingAppointment(apt);
    setFormData({
      client_id: apt.client_id,
      service_id: apt.service_id,
      professional_id: apt.professional_id ? String(apt.professional_id) : '',
      appointment_date: getAppointmentDateKey(apt.appointment_date),
      appointment_time: apt.appointment_time.slice(0, 5),
      notes: apt.notes || '',
    });
    setNewClientMode(false);
    setShowScheduleModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar esta cita?')) {
      await api.delete(`/appointments/${id}`);
      if (selectedAppointment?.id === id) {
        closeDetailModal();
      }
      loadAppointments();
    }
  };

  const handleSessionNotesSaved = (appointmentId, notes) => {
    setAppointments(prev => prev.map(apt => (apt.id === appointmentId ? { ...apt, notes } : apt)));
    setSelectedAppointment(prev => (prev?.id === appointmentId ? { ...prev, notes } : prev));
  };

  const handleStatusChange = async (id, status) => {
    await api.put(`/appointments/${id}`, { status });
    setAppointments(prev => prev.map(apt => (apt.id === id ? { ...apt, status } : apt)));
    setSelectedAppointment(prev => (prev?.id === id ? { ...prev, status } : prev));
  };

  const selectAppointment = (apt) => {
    setSelectedAppointment(apt);
    setSelectedClientId(apt.client_id);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      service_id: '',
      professional_id: '',
      appointment_date: format(new Date(), 'yyyy-MM-dd'),
      appointment_time: '09:00',
      notes: '',
    });
    setNewClientData({ name: '', email: '', phone: '' });
    setNewClientMode(false);
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const canManageAppointments = isAdmin;
  const tableColumnCount = isAdmin ? 7 : 5;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{isAdmin ? 'Citas' : 'Mis sesiones'}</h1>
          <p className="subtitle">
            {isAdmin
              ? `${appointments.length} citas en total`
              : 'Consulta el expediente del paciente y agenda nuevas sesiones'}
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              const client = selectedAppointment?.client_id
                ? { id: selectedAppointment.client_id }
                : null;
              openScheduleModal(client);
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>add</span>
            {isAdmin ? 'Nueva cita' : 'Agendar cita'}
          </button>
        </div>
      </div>

      <div className="card appointments-list-card">
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)', fontSize: '20px' }}>calendar_today</span>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                style={{ padding: '12px 16px', paddingLeft: '44px', border: 'none', borderRadius: '0.75rem', background: 'var(--surface-container)', fontSize: '14px', width: '100%' }}
              />
            </div>
            <select
              value={filters.dateField}
              onChange={(e) => setFilters({ ...filters, dateField: e.target.value })}
              style={{ padding: '12px 16px', border: 'none', borderRadius: '0.75rem', background: 'var(--surface-container)', fontSize: '14px', minWidth: '190px' }}
              title="Campo usado por el filtro de fecha"
            >
              <option value="appointment">Filtrar: fecha de cita</option>
              <option value="created">Filtrar: registro</option>
            </select>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              style={{ padding: '12px 16px', border: 'none', borderRadius: '0.75rem', background: 'var(--surface-container)', fontSize: '14px', minWidth: '190px' }}
              title="Orden de la lista"
            >
              <option value="appointment">Ordenar: fecha de cita</option>
              <option value="created">Ordenar: registro</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              style={{ padding: '12px 16px', border: 'none', borderRadius: '0.75rem', background: 'var(--surface-container)', fontSize: '14px', minWidth: '160px' }}
            >
              <option value="">Todos los estados</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  {isAdmin && <th>Profesional</th>}
                  <th>Registro</th>
                  <th>Fecha y hora de cita</th>
                  <th>Estado</th>
                  {canManageAppointments && <th style={{ textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumnCount} style={{ textAlign: 'center', padding: '48px', color: 'var(--on-surface-variant)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.3, display: 'block', marginBottom: '12px' }}>event_busy</span>
                      No se encontraron citas
                    </td>
                  </tr>
                ) : (
                  appointments.map(apt => (
                    <tr
                      key={apt.id}
                      className={`appointments-row ${selectedAppointment?.id === apt.id ? 'is-selected' : ''}`}
                      onClick={() => selectAppointment(apt)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="appointments-row-avatar">
                            {getInitials(apt.client_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{apt.client_name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{apt.client_email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '4px 12px',
                          background: `${apt.service_color || '#7d7f3e'}15`,
                          color: apt.service_color || '#7d7f3e',
                          borderRadius: '2rem',
                          fontSize: '13px',
                          fontWeight: 500,
                        }}>
                          {apt.service_name}
                        </span>
                      </td>
                      {isAdmin && (
                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                          {apt.professional_name?.trim() || 'Sin asignar'}
                        </span>
                      </td>
                      )}
                      <td>
                        <div style={{ fontSize: '14px' }}>{formatRegistrationDate(apt.created_at)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{formatAppointmentDate(apt.appointment_date)}</div>
                        <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                          {(apt.appointment_time || '').slice(0, 5)}
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {canManageAppointments ? (
                          <select
                            value={apt.status}
                            onChange={(e) => handleStatusChange(apt.id, e.target.value)}
                            className={`status-badge status-${apt.status}`}
                            style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '2rem', fontSize: '12px', fontWeight: 600 }}
                          >
                            {STATUS_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`status-badge status-${apt.status}`}>
                            {getStatusLabel(apt.status)}
                          </span>
                        )}
                      </td>
                      {canManageAppointments && (
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleEdit(apt)}
                            style={{ padding: '8px', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--on-surface-variant)' }}
                            title="Editar"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(apt.id)}
                            style={{ padding: '8px', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error)' }}
                            title="Eliminar"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      {showDetailModal && selectedClientId && (
        <div className="modal-overlay" onClick={closeDetailModal}>
          <div className="modal client-expediente-modal" onClick={(e) => e.stopPropagation()}>
            <div className="client-expediente-modal-header">
              <h2>Detalle de la cita</h2>
              <button type="button" className="client-expediente-modal-close" onClick={closeDetailModal} aria-label="Cerrar">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="client-expediente-modal-body">
              <ClientExpedientePanel
                clientId={selectedClientId}
                selectedAppointment={selectedAppointment}
                variant="appointments"
                refreshKey={expedienteRefreshKey}
                canEditNotes
                canEditProfile
                canUploadFiles={false}
                canChangeStatus
                onStatusChange={handleStatusChange}
                onRefresh={loadAppointments}
                onSelectAppointment={selectAppointment}
                onSessionNotesSaved={handleSessionNotesSaved}
                embedded
              />
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingAppointment ? 'Editar cita' : 'Agendar cita'}</h2>
            <form onSubmit={handleSubmit}>
              {!editingAppointment && !isAdmin && (
                <label className="mail-checkbox" style={{ marginBottom: '16px' }}>
                  <input
                    type="checkbox"
                    checked={newClientMode}
                    onChange={(e) => setNewClientMode(e.target.checked)}
                  />
                  Registrar paciente nuevo
                </label>
              )}

              {newClientMode && !editingAppointment ? (
                <>
                  <div className="form-group">
                    <label>Nombre del paciente</label>
                    <input
                      type="text"
                      value={newClientData.name}
                      onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Correo</label>
                    <input
                      type="email"
                      value={newClientData.email}
                      onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    />
                    <small style={{ color: 'var(--on-surface-variant)' }}>Correo o teléfono requerido.</small>
                  </div>
                  <div className="form-group">
                    <label>Teléfono / WhatsApp</label>
                    <input
                      type="text"
                      value={newClientData.phone}
                      onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Cliente</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar cliente</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Servicio</label>
                <select
                  value={formData.service_id}
                  onChange={(e) => {
                    const serviceId = e.target.value;
                    const available = getProfessionalsForService(serviceId);
                    setFormData(prev => ({
                      ...prev,
                      service_id: serviceId,
                      professional_id: available.some(p => String(p.id) === prev.professional_id)
                        ? prev.professional_id
                        : '',
                    }));
                  }}
                  required
                >
                  <option value="">Seleccionar servicio</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <div className="form-group">
                  <label>Profesional</label>
                  <select
                    value={formData.professional_id}
                    onChange={(e) => setFormData({ ...formData, professional_id: e.target.value })}
                  >
                    <option value="">Sin asignar</option>
                    {getProfessionalsForService(formData.service_id).map(p => (
                      <option key={p.id} value={p.id}>{p.full_name || p.username}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Hora</label>
                  <input
                    type="time"
                    value={formData.appointment_time}
                    onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notas de la sesión</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  placeholder="Motivo, observaciones o indicaciones..."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAppointment ? 'Guardar cambios' : 'Agendar cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
