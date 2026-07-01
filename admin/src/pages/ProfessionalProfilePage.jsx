import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import PasswordInput from '../components/PasswordInput';

export default function ProfessionalProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    profile_bio: '',
    booking_slug: '',
  });
  const [password, setPassword] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const applyProfileData = (data) => {
    if (!data) return;
    setProfile(data);
    setFormData({
      full_name: data.full_name || '',
      email: data.email || '',
      profile_bio: data.profile_bio || '',
      booking_slug: data.booking_slug || '',
    });
    setPhotoPreview(data.profile_photo_url || '');
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      let data = null;
      try {
        const res = await api.get('/professional/profile');
        data = res.data.user || null;
      } catch {
        // Si el endpoint no está disponible, usamos los datos de sesión.
      }

      if (!data) {
        const refreshed = await refreshUser?.();
        data = refreshed || user;
      }

      applyProfileData(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await api.put('/professional/profile', formData);
      setProfile(res.data.user || profile);
      setPhotoPreview(res.data.user?.profile_photo_url || photoPreview);
      setMessage('Perfil actualizado correctamente');
      await refreshUser?.();
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
      await api.put('/professional/password', { password });
      setPassword('');
      setMessage('Contraseña actualizada correctamente');
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo actualizar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));
    const data = new FormData();
    data.append('photo', file);
    setUploadingPhoto(true);
    setMessage('');
    try {
      const res = await api.post('/professional/profile/photo', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data.user || {};
      setProfile(updated);
      setPhotoPreview(updated.profile_photo_url || res.data.profile_photo_url || '');
      setMessage('Foto actualizada correctamente');
      await refreshUser?.();
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo subir la foto');
      setPhotoPreview(profile?.profile_photo_url || '');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const removePhoto = async () => {
    setUploadingPhoto(true);
    setMessage('');
    try {
      const res = await api.delete('/professional/profile/photo');
      const updated = res.data.user || {};
      setProfile(updated);
      setPhotoPreview('');
      setMessage('Foto eliminada');
      await refreshUser?.();
    } catch (err) {
      setMessage(err.response?.data?.error || 'No se pudo eliminar la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const copyBookingLink = () => {
    const url = profile?.booking_url || `${window.location.origin}/booking/public/?professional=${profile?.id || user?.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const services = profile?.services || [];

  if (loading) {
    return <div className="card">Cargando perfil...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mi perfil</h1>
          <p className="subtitle">
            Actualiza tus datos, currículum y foto. Esta información se muestra en tu enlace de reservas.
          </p>
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
        <h3 style={{ marginBottom: '16px' }}>Foto de perfil</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', alignItems: 'start' }}>
          <div style={{ width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {photoPreview ? (
              <img src={photoPreview} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--on-surface-variant)' }}>person</span>
            )}
          </div>
          <div>
            <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)', marginBottom: '12px' }}>
              JPG, PNG o WEBP. Máximo 5 MB. Visible en el booking público.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>upload</span>
                {uploadingPhoto ? 'Subiendo...' : 'Subir foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} disabled={uploadingPhoto} />
              </label>
              {photoPreview && (
                <button type="button" className="btn btn-secondary" onClick={removePhoto} disabled={uploadingPhoto}>
                  Quitar foto
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Datos personales</h3>
        <form onSubmit={handleSaveProfile}>
          <div className="form-group">
            <label>Nombre completo</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Correo</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Currículum / presentación</label>
            <textarea
              value={formData.profile_bio}
              onChange={(e) => setFormData({ ...formData, profile_bio: e.target.value })}
              rows="5"
              placeholder="Describe tu experiencia, especialidades y enfoque terapéutico."
            />
          </div>
          <div className="form-group">
            <label>Enlace personalizado (opcional)</label>
            <input
              type="text"
              value={formData.booking_slug}
              onChange={(e) => setFormData({ ...formData, booking_slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              placeholder="maria-garcia"
            />
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '8px' }}>
              Si lo defines, el enlace será: {window.location.origin}/booking/public/?p={formData.booking_slug || 'tu-enlace'}
            </p>
          </div>
          {profile?.booking_url && (
            <div className="form-group">
              <label>Enlace de reservas</label>
              <div className="url-input-group">
                <input type="text" className="url-input" value={profile.booking_url} readOnly />
                <button type="button" className="copy-btn" onClick={copyBookingLink}>
                  <span className="material-symbols-outlined">{copiedLink ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </form>
      </div>

      {services.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px' }}>Servicios asignados</h3>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '16px' }}>
            Los servicios los administra el administrador. Aquí solo puedes consultarlos.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {services.map((service) => (
              <span
                key={service.id}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'var(--surface-container)',
                  fontSize: '14px',
                }}
              >
                {service.name}
              </span>
            ))}
          </div>
        </div>
      )}

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
