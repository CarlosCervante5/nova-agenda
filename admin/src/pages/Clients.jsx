import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ClientExpedientePanel from '../components/ClientExpedientePanel';

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExpedienteModal, setShowExpedienteModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });

  useEffect(() => {
    loadClients();
  }, [search]);

  const loadClients = async () => {
    const res = await api.get(`/clients?search=${search}`);
    setClients(res.data);
  };

  const validateUnique = async (email, phone, excludeId = null) => {
    const params = new URLSearchParams();
    if (email) params.append('email', email);
    if (phone) params.append('phone', phone);
    if (excludeId) params.append('exclude_id', excludeId);

    const res = await api.get(`/clients/check-unique?${params}`);
    if (!res.data.unique) {
      const dup = res.data.duplicate;
      throw new Error(res.data.message || `Ya existe un cliente: ${dup?.name || 'duplicado'}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.email.trim() && !formData.phone.trim()) {
      setFormError('Indica al menos un correo o teléfono para identificar al cliente.');
      return;
    }

    try {
      await validateUnique(formData.email, formData.phone);

      await api.post('/clients', formData);

      setShowEditModal(false);
      resetForm();
      loadClients();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'No se pudo guardar el cliente');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este cliente?')) {
      await api.delete(`/clients/${id}`);
      if (selectedClientId === id) {
        setSelectedClientId(null);
        setSelectedAppointment(null);
      }
      loadClients();
    }
  };

  const openExpediente = (client) => {
    setSelectedClientId(client.id);
    setSelectedAppointment(null);
    setShowExpedienteModal(true);
  };

  const closeExpediente = () => {
    setShowExpedienteModal(false);
    setSelectedClientId(null);
    setSelectedAppointment(null);
  };

  const selectAppointment = (apt) => {
    setSelectedAppointment(apt);
    setSelectedClientId(apt.client_id);
  };

  const handleStatusChange = async (id, status) => {
    await api.put(`/appointments/${id}`, { status });
    setSelectedAppointment(prev => (prev?.id === id ? { ...prev, status } : prev));
  };

  const handleSessionNotesSaved = (appointmentId, notes) => {
    setSelectedAppointment(prev => (prev?.id === appointmentId ? { ...prev, notes } : prev));
  };

  const handleSchedule = (client) => {
    navigate('/appointments', { state: { scheduleClientId: client.id } });
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', notes: '' });
    setFormError('');
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clientes</h1>
          <p className="subtitle">Gestiona tu comunidad de {clients.length} clientes</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowEditModal(true); }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>person_add</span>
            Nuevo cliente
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total clientes</div>
            <div className="stat-value">{clients.length}</div>
          </div>
          <div className="stat-icon primary">
            <span className="material-symbols-outlined">group</span>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Con acceso web</div>
            <div className="stat-value">{clients.filter(c => c.has_profile).length}</div>
          </div>
          <div className="stat-icon secondary">
            <span className="material-symbols-outlined">account_circle</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="search-bar" style={{ marginBottom: '24px' }}>
          <span className="material-symbols-outlined search-icon">search</span>
          <input
            type="text"
            placeholder="Buscar por nombre, correo o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Usuario</th>
                <th>Registro</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: 'var(--on-surface-variant)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.3, display: 'block', marginBottom: '12px' }}>person_off</span>
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                clients.map(client => (
                  <tr key={client.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="appointments-row-avatar">
                          {getInitials(client.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '15px' }}>{client.name}</div>
                          {client.notes && (
                            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {client.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '14px' }}>{client.email || '-'}</div>
                      <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{client.phone || '-'}</div>
                    </td>
                    <td>
                      {client.profile_username ? (
                        <span className="status-badge status-confirmed" style={{ fontSize: '12px' }}>
                          {client.profile_username}
                        </span>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>Pendiente</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '14px' }}>
                        {new Date(client.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openExpediente(client)}
                        style={{ padding: '8px 12px', borderRadius: '0.5rem', border: '1px solid var(--outline-variant)', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', fontSize: '13px', fontWeight: 600, marginRight: '8px' }}
                      >
                        Expediente
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        style={{ padding: '8px', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error)' }}
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showExpedienteModal && selectedClientId && (
        <div className="modal-overlay" onClick={closeExpediente}>
          <div className="modal client-expediente-modal" onClick={(e) => e.stopPropagation()}>
            <div className="client-expediente-modal-header">
              <h2>Expediente del paciente</h2>
              <button type="button" className="client-expediente-modal-close" onClick={closeExpediente} aria-label="Cerrar">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="client-expediente-modal-body">
              <ClientExpedientePanel
                clientId={selectedClientId}
                selectedAppointment={selectedAppointment}
                canEditNotes
                canEditProfile
                canUploadFiles
                canChangeStatus
                onStatusChange={handleStatusChange}
                onSchedule={(client) => {
                  closeExpediente();
                  handleSchedule(client);
                }}
                onRefresh={loadClients}
                onSelectAppointment={selectAppointment}
                onSessionNotesSaved={handleSessionNotesSaved}
                embedded
              />
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nuevo cliente</h2>
            <p style={{ color: 'var(--on-surface-variant)', marginBottom: '16px', fontSize: '14px' }}>
              Se creará automáticamente un acceso web. Edita datos y contraseña desde el expediente.
            </p>
            {formError && <div className="error-message" style={{ marginBottom: '16px' }}>{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre completo *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre del cliente"
                  required
                />
              </div>

              <div className="form-group">
                <label>Correo *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@correo.com"
                />
                <small style={{ color: 'var(--on-surface-variant)' }}>Indica correo o teléfono (al menos uno).</small>
              </div>

              <div className="form-group">
                <label>Teléfono</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+52 000 000 0000"
                />
              </div>

              <div className="form-group">
                <label>Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  placeholder="Preferencias, observaciones, etc."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
