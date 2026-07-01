import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import PasswordInput from '../components/PasswordInput';
import { getStatusLabel } from '../utils/labels';

export default function ClientProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/client/profile');
      setProfile(res.data);
      setFormData({
        name: res.data.client?.name || '',
        email: res.data.client?.email || '',
        phone: res.data.client?.phone || '',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.put('/client/profile', formData);
      setMessage('Perfil actualizado correctamente');
      await loadProfile();
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!password) return;
    setSaving(true);
    setMessage('');
    try {
      await api.put('/client/password', { password });
      setPassword('');
      setMessage('Contraseña actualizada correctamente');
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo actualizar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const appointments = profile?.appointments || [];
  const generalNotes = profile?.client?.notes?.trim() || '';
  const sessionsWithNotes = appointments.filter((apt) => apt.notes?.trim());

  if (loading) {
    return <div className="card">Cargando perfil...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mi perfil</h1>
          <p className="subtitle">Actualiza tus datos de contacto, consulta las notas de tu profesional y tu historial de sesiones.</p>
        </div>
      </div>

      {message && (
        <div className="card" style={{
          marginBottom: '20px',
          padding: '14px 18px',
          background: message.includes('No se') ? '#ffdad6' : 'var(--primary-fixed)',
          color: message.includes('No se') ? 'var(--error)' : 'var(--primary)',
        }}>
          {message}
        </div>
      )}

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Datos personales</h3>
        <form onSubmit={handleSaveProfile}>
          <div className="form-group">
            <label>Nombre completo</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Correo</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Teléfono / WhatsApp</label>
            <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '8px' }}>Notas generales de tu profesional</h3>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '16px' }}>
          Observaciones, indicaciones o seguimiento compartido por tu terapeuta.
        </p>
        {generalNotes ? (
          <div className="client-profile-notes">{generalNotes}</div>
        ) : (
          <p style={{ color: 'var(--on-surface-variant)', margin: 0 }}>Aún no hay notas generales registradas.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '8px' }}>Notas por sesión</h3>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '16px' }}>
          Resumen o indicaciones de cada cita completada o atendida.
        </p>
        {sessionsWithNotes.length === 0 ? (
          <p style={{ color: 'var(--on-surface-variant)', margin: 0 }}>Aún no hay notas de sesión disponibles.</p>
        ) : (
          <div className="client-expediente-history">
            {sessionsWithNotes.map((apt) => (
              <div key={apt.id} className="client-expediente-history-item" style={{ cursor: 'default' }}>
                <div className="client-expediente-history-main">
                  <div>
                    <strong>{apt.service_name}</strong>
                    <span>
                      {format(parseISO(apt.appointment_date.split('T')[0]), 'dd/MM/yyyy')}
                      {' · '}
                      {(apt.appointment_time || '').slice(0, 5)}
                      {apt.professional_name ? ` · ${apt.professional_name}` : ''}
                    </span>
                  </div>
                  <span className={`status-badge status-${apt.status}`}>{getStatusLabel(apt.status)}</span>
                </div>
                <p className="client-expediente-history-notes">{apt.notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Acceso</h3>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '16px' }}>
          Usuario: <strong>{user?.username}</strong>
        </p>
        <form onSubmit={handleSavePassword}>
          <div className="form-group">
            <label>Nueva contraseña</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <button type="submit" className="btn btn-secondary" disabled={saving || !password}>
            Cambiar contraseña
          </button>
        </form>
      </div>
    </div>
  );
}
