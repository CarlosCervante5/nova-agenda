import { useState, useEffect } from 'react';
import api from '../../api';
import PasswordInput from '../PasswordInput';

const defaultProfessionalForm = {
  username: '',
  email: '',
  full_name: '',
  password: '',
  active: true,
  service_ids: [],
  profile_bio: '',
  booking_slug: '',
  profile_photo_url: '',
};

const defaultAdminForm = {
  username: '',
  email: '',
  full_name: '',
  password: '',
  active: true,
};

export default function UsersSettingsTab({ mode = 'all' }) {
  const [userSection, setUserSection] = useState(mode === 'admins' ? 'admins' : 'professionals');
  const [professionals, setProfessionals] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewProfessional, setViewProfessional] = useState(null);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [formData, setFormData] = useState(defaultProfessionalForm);
  const [adminForm, setAdminForm] = useState(defaultAdminForm);
  const [saving, setSaving] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([loadProfessionals(), loadAdmins(), loadServices(), loadCategories()]);
  };

  const loadAdmins = async () => {
    const res = await api.get('/users/admins');
    setAdmins(res.data);
  };

  const loadProfessionals = async () => {
    const res = await api.get('/users/professionals');
    setProfessionals(res.data);
  };

  const loadServices = async () => {
    const res = await api.get('/services');
    setServices(res.data.filter(s => s.active !== 0));
  };

  const loadCategories = async () => {
    const res = await api.get('/categories');
    setCategories(res.data);
  };

  const resetServiceFilters = () => {
    setServiceSearch('');
    setServiceCategoryFilter('');
  };

  const openCreate = () => {
    setEditing(null);
    setFormData(defaultProfessionalForm);
    setPhotoPreview('');
    setPendingPhoto(null);
    resetServiceFilters();
    setShowModal(true);
  };

  const openCreateAdmin = () => {
    setEditingAdmin(null);
    setAdminForm(defaultAdminForm);
    setShowAdminModal(true);
  };

  const openEditAdmin = async (adminUser) => {
    try {
      const res = await api.get(`/users/admins/${adminUser.id}`);
      const user = res.data;
      setEditingAdmin(user);
      setAdminForm({
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        password: '',
        active: !!user.active,
      });
      setShowAdminModal(true);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo cargar el administrador');
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (!editingAdmin && !adminForm.password) {
      alert('La contraseña es obligatoria al crear un administrador.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        username: adminForm.username.trim(),
        email: adminForm.email.trim(),
        full_name: adminForm.full_name.trim(),
        active: adminForm.active ? 1 : 0,
      };
      if (adminForm.password) payload.password = adminForm.password;

      if (editingAdmin) {
        await api.put(`/users/admins/${editingAdmin.id}`, payload);
      } else {
        await api.post('/users/admins', payload);
      }

      setShowAdminModal(false);
      setEditingAdmin(null);
      setAdminForm(defaultAdminForm);
      loadAdmins();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo guardar el administrador');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateAdmin = async (adminUser) => {
    if (adminUser.username === 'admin') {
      alert('No se puede desactivar el administrador principal.');
      return;
    }
    if (!confirm(`¿Desactivar a ${adminUser.full_name || adminUser.username}?`)) return;
    try {
      await api.delete(`/users/admins/${adminUser.id}`);
      loadAdmins();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo desactivar');
    }
  };

  const openEdit = async (professional) => {
    try {
      const res = await api.get(`/users/professionals/${professional.id}`);
      const user = res.data;
      setEditing(user);
      setFormData({
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        password: '',
        active: !!user.active,
        service_ids: user.service_ids || [],
        profile_bio: user.profile_bio || '',
        booking_slug: user.booking_slug || '',
        profile_photo_url: user.profile_photo_url || '',
      });
      setPhotoPreview(user.profile_photo_url || '');
      setPendingPhoto(null);
      resetServiceFilters();
      setShowModal(true);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo cargar el profesional');
    }
  };

  const openView = async (professional) => {
    try {
      const res = await api.get(`/users/professionals/${professional.id}`);
      setViewProfessional(res.data);
      setShowViewModal(true);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo cargar el profesional');
    }
  };

  const toggleService = (serviceId) => {
    setFormData(prev => {
      const ids = prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter(id => id !== serviceId)
        : [...prev.service_ids, serviceId];
      return { ...prev, service_ids: ids };
    });
  };

  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'Sin categoría';
    return categories.find(c => c.id === categoryId)?.name || 'Sin categoría';
  };

  const getServiceColor = (service) => {
    const category = categories.find(c => c.id === service.category_id);
    return category?.color || service.color || '#7d7f3e';
  };

  const getFilteredServices = () => {
    const query = serviceSearch.trim().toLowerCase();

    return services.filter(service => {
      const matchesSearch = !query
        || service.name.toLowerCase().includes(query)
        || getCategoryName(service.category_id).toLowerCase().includes(query);
      const matchesCategory = !serviceCategoryFilter
        || String(service.category_id || '') === String(serviceCategoryFilter);
      return matchesSearch && matchesCategory;
    });
  };

  const toggleFilteredServices = (selectAll) => {
    const ids = getFilteredServices().map(s => s.id);

    setFormData(prev => {
      const next = new Set(prev.service_ids);
      ids.forEach(id => {
        if (selectAll) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return { ...prev, service_ids: Array.from(next) };
    });
  };

  const toggleAllServices = (selectAll) => {
    setFormData(prev => ({
      ...prev,
      service_ids: selectAll ? services.map(s => s.id) : [],
    }));
  };

  const uploadPhoto = async (professionalId, file) => {
    const data = new FormData();
    data.append('photo', file);
    setUploadingPhoto(true);
    try {
      const res = await api.post(`/users/professionals/${professionalId}/photo`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData(prev => ({
        ...prev,
        profile_photo_url: res.data.profile_photo_url || prev.profile_photo_url,
      }));
      setPhotoPreview(res.data.profile_photo_url || '');
      setPendingPhoto(null);
      loadProfessionals();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo subir la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));

    if (editing?.id) {
      await uploadPhoto(editing.id, file);
      return;
    }

    setPendingPhoto(file);
  };

  const removePhoto = async () => {
    if (editing?.id && formData.profile_photo_url) {
      try {
        await api.delete(`/users/professionals/${editing.id}/photo`);
      } catch (err) {
        alert(err.response?.data?.error || 'No se pudo eliminar la foto');
        return;
      }
    }

    setPhotoPreview('');
    setPendingPhoto(null);
    setFormData(prev => ({ ...prev, profile_photo_url: '' }));
    loadProfessionals();
  };

  const copyBookingLink = (professional) => {
    const url = professional.booking_url || `${window.location.origin}/booking/public/?professional=${professional.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(professional.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.service_ids.length === 0) {
      alert('Selecciona al menos un servicio que atenderá este profesional.');
      return;
    }

    if (!editing && !formData.password) {
      alert('La contraseña es obligatoria al crear un profesional.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        active: formData.active ? 1 : 0,
        service_ids: formData.service_ids,
        profile_bio: formData.profile_bio.trim(),
        booking_slug: formData.booking_slug.trim(),
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (editing) {
        await api.put(`/users/professionals/${editing.id}`, payload);
        if (pendingPhoto) {
          await uploadPhoto(editing.id, pendingPhoto);
        }
      } else {
        const res = await api.post('/users/professionals', payload);
        if (pendingPhoto && res.data?.id) {
          await uploadPhoto(res.data.id, pendingPhoto);
        }
      }

      setShowModal(false);
      setEditing(null);
      setFormData(defaultProfessionalForm);
      setPhotoPreview('');
      setPendingPhoto(null);
      loadProfessionals();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo guardar el profesional');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfessional = async (professional) => {
    if (professional.username === 'profesional') {
      alert('No se puede eliminar el usuario principal.');
      return;
    }

    const name = professional.full_name || professional.username;
    if (!confirm(`¿Eliminar a ${name}? Sus citas se conservarán, pero ya no podrá iniciar sesión.`)) {
      return;
    }

    try {
      await api.delete(`/users/professionals/${professional.id}`);
      if (viewProfessional?.id === professional.id) {
        setShowViewModal(false);
        setViewProfessional(null);
      }
      loadProfessionals();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo eliminar el profesional');
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const filteredServices = getFilteredServices();
  const allFilteredSelected = filteredServices.length > 0
    && filteredServices.every(s => formData.service_ids.includes(s.id));
  const someFilteredSelected = filteredServices.some(s => formData.service_ids.includes(s.id));

  const activeProfessionals = professionals.filter(p => p.active).length;
  const activeAdmins = admins.filter(a => a.active).length;

  const showSectionTabs = mode === 'all';
  const visibleSection = mode === 'all' ? userSection : mode;

  return (
    <div>
      {showSectionTabs && (
      <div className="settings-tabs" style={{ marginBottom: '20px' }}>
        <button type="button" className={`settings-tab ${userSection === 'professionals' ? 'active' : ''}`} onClick={() => setUserSection('professionals')}>
          <span className="material-symbols-outlined">badge</span>
          Profesionales
        </button>
        <button type="button" className={`settings-tab ${userSection === 'admins' ? 'active' : ''}`} onClick={() => setUserSection('admins')}>
          <span className="material-symbols-outlined">admin_panel_settings</span>
          Administradores
        </button>
      </div>
      )}

      {visibleSection === 'professionals' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', margin: 0 }}>
              Crea cuentas de profesionales y asigna los servicios que atenderán.
            </p>
            <button className="btn btn-primary" onClick={openCreate}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>person_add</span>
              Nuevo profesional
            </button>
          </div>

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Profesionales activos</div>
            <div className="stat-value">{activeProfessionals}</div>
          </div>
          <div className="stat-icon primary">
            <span className="material-symbols-outlined">badge</span>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-label">Total registrados</div>
            <div className="stat-value">{professionals.length}</div>
          </div>
          <div className="stat-icon secondary">
            <span className="material-symbols-outlined">groups</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Profesional</th>
                <th>Usuario</th>
                <th>Servicios</th>
                <th>Enlace booking</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {professionals.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--on-surface-variant)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.3, display: 'block', marginBottom: '12px' }}>badge</span>
                    Aún no hay profesionales registrados
                  </td>
                </tr>
              ) : (
                professionals.map(professional => (
                  <tr key={professional.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {professional.profile_photo_url ? (
                          <img
                            src={professional.profile_photo_url}
                            alt={professional.full_name}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="avatar">{getInitials(professional.full_name || professional.username)}</div>
                        )}
                        <div>
                          <div style={{ fontWeight: 500 }}>{professional.full_name}</div>
                          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{professional.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{professional.username}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'var(--primary-fixed)',
                        color: 'var(--primary)',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>spa</span>
                        {professional.services_count || 0} servicios
                      </span>
                    </td>
                    <td>
                      {professional.active ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => copyBookingLink(professional)}
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>
                            {copiedLinkId === professional.id ? 'check' : 'link'}
                          </span>
                          {copiedLinkId === professional.id ? 'Copiado' : 'Copiar enlace'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: professional.active ? 'rgba(125, 127, 62, 0.12)' : 'var(--surface-container)',
                        color: professional.active ? 'var(--primary)' : 'var(--on-surface-variant)',
                      }}>
                        {professional.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openView(professional)}
                        style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--on-surface-variant)' }}
                        title="Ver detalles"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>visibility</span>
                      </button>
                      <button
                        onClick={() => openEdit(professional)}
                        style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--on-surface-variant)' }}
                        title="Editar"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                      </button>
                      {professional.username !== 'profesional' ? (
                        <button
                          onClick={() => handleDeleteProfessional(professional)}
                          style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error)' }}
                          title="Eliminar"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {visibleSection === 'admins' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', margin: 0 }}>
              Gestiona las cuentas con acceso completo al panel de administración.
            </p>
            <button className="btn btn-primary" onClick={openCreateAdmin}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>person_add</span>
              Nuevo administrador
            </button>
          </div>

          <div className="stats-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div>
                <div className="stat-label">Administradores activos</div>
                <div className="stat-value">{activeAdmins}</div>
              </div>
              <div className="stat-icon primary">
                <span className="material-symbols-outlined">admin_panel_settings</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Administrador</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '48px', color: 'var(--on-surface-variant)' }}>
                        No hay administradores registrados
                      </td>
                    </tr>
                  ) : (
                    admins.map(adminUser => (
                      <tr key={adminUser.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{adminUser.full_name}</div>
                          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>{adminUser.email}</div>
                        </td>
                        <td>{adminUser.username}</td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: adminUser.active ? 'rgba(125, 127, 62, 0.12)' : 'var(--surface-container)',
                            color: adminUser.active ? 'var(--primary)' : 'var(--on-surface-variant)',
                          }}>
                            {adminUser.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => openEditAdmin(adminUser)} style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--on-surface-variant)' }} title="Editar">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                          </button>
                          {adminUser.username !== 'admin' && adminUser.active ? (
                            <button onClick={() => handleDeactivateAdmin(adminUser)} style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error)' }} title="Desactivar">
                              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person_off</span>
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showViewModal && viewProfessional && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Detalle del profesional</h2>
              <button type="button" className="close-btn" onClick={() => setShowViewModal(false)} aria-label="Cerrar">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
              {viewProfessional.profile_photo_url ? (
                <img
                  src={viewProfessional.profile_photo_url}
                  alt={viewProfessional.full_name}
                  style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div className="avatar" style={{ width: '72px', height: '72px', fontSize: '24px' }}>
                  {getInitials(viewProfessional.full_name || viewProfessional.username)}
                </div>
              )}
              <div>
                <div style={{ fontSize: '20px', fontWeight: 600 }}>{viewProfessional.full_name}</div>
                <div style={{ color: 'var(--on-surface-variant)' }}>@{viewProfessional.username}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
              <div><strong>Correo:</strong> {viewProfessional.email || '—'}</div>
              <div><strong>Estado:</strong> {viewProfessional.active ? 'Activo' : 'Inactivo'}</div>
              <div><strong>Servicios asignados:</strong> {viewProfessional.services_count || viewProfessional.service_ids?.length || 0}</div>
              {viewProfessional.profile_bio && (
                <div><strong>Presentación:</strong> {viewProfessional.profile_bio}</div>
              )}
              {viewProfessional.booking_slug && (
                <div><strong>Enlace personalizado:</strong> {viewProfessional.booking_slug}</div>
              )}
              {viewProfessional.booking_url && (
                <div style={{ wordBreak: 'break-all' }}><strong>Booking:</strong> {viewProfessional.booking_url}</div>
              )}
            </div>

            <div className="modal-actions">
              {viewProfessional.username !== 'profesional' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginRight: 'auto', color: 'var(--error)' }}
                  onClick={() => handleDeleteProfessional(viewProfessional)}
                >
                  Eliminar
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowViewModal(false);
                  openEdit(viewProfessional);
                }}
              >
                Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '760px' }} onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar profesional' : 'Nuevo profesional'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre completo *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Usuario *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>Correo *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{editing ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</label>
                <PasswordInput
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editing}
                  autoComplete="new-password"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', alignItems: 'start', marginBottom: '20px' }}>
                <div style={{ width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--on-surface-variant)' }}>person</span>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Foto de perfil</label>
                  <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginBottom: '12px' }}>
                    Se mostrará en el booking público cuando agenden con el enlace del profesional.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>upload</span>
                      {uploadingPhoto ? 'Subiendo...' : 'Subir foto'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} disabled={uploadingPhoto} />
                    </label>
                    {(photoPreview || formData.profile_photo_url) && (
                      <button type="button" className="btn btn-secondary" onClick={removePhoto} disabled={uploadingPhoto}>
                        Quitar foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Presentación breve</label>
                <textarea
                  value={formData.profile_bio}
                  onChange={(e) => setFormData({ ...formData, profile_bio: e.target.value })}
                  rows="3"
                  placeholder="Ej. Especialista en terapias holísticas con 10 años de experiencia."
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

              {editing?.booking_url && (
                <div className="form-group">
                  <label>Enlace de booking</label>
                  <div className="url-input-group">
                    <input type="text" className="url-input" value={editing.booking_url} readOnly />
                    <button type="button" className="copy-btn" onClick={() => copyBookingLink(editing)}>
                      <span className="material-symbols-outlined">{copiedLinkId === editing.id ? 'check' : 'content_copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  />
                  Cuenta activa
                </label>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ marginBottom: 0 }}>Servicios que atiende *</label>
                  <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
                    {formData.service_ids.length} seleccionados
                  </span>
                </div>

                <div className="service-picker-panel">
                  <div className="service-picker-toolbar">
                    <input
                      type="search"
                      className="service-picker-search"
                      placeholder="Buscar servicio o categoría..."
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                    />
                    <select
                      className="service-picker-filter"
                      value={serviceCategoryFilter}
                      onChange={(e) => setServiceCategoryFilter(e.target.value)}
                    >
                      <option value="">Todas las categorías</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                    <div className="service-picker-toolbar-actions">
                      <button
                        type="button"
                        className="btn btn-secondary service-picker-btn"
                        onClick={() => toggleFilteredServices(true)}
                        disabled={filteredServices.length === 0}
                      >
                        Seleccionar visibles
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary service-picker-btn"
                        onClick={() => toggleFilteredServices(false)}
                        disabled={filteredServices.length === 0}
                      >
                        Quitar visibles
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary service-picker-btn"
                        onClick={() => toggleAllServices(true)}
                        disabled={services.length === 0}
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary service-picker-btn"
                        onClick={() => toggleAllServices(false)}
                        disabled={formData.service_ids.length === 0}
                      >
                        Quitar todos
                      </button>
                    </div>
                  </div>

                  {services.length === 0 ? (
                    <p className="service-picker-empty">
                      No hay servicios activos. Crea servicios primero en la sección Servicios.
                    </p>
                  ) : filteredServices.length === 0 ? (
                    <p className="service-picker-empty">
                      No hay servicios que coincidan con los filtros.
                    </p>
                  ) : (
                    <div className="service-picker-table-wrap">
                      <table className="service-picker-table">
                        <thead>
                          <tr>
                            <th className="col-check">
                              <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                ref={(el) => {
                                  if (el) {
                                    el.indeterminate = someFilteredSelected && !allFilteredSelected;
                                  }
                                }}
                                onChange={() => toggleFilteredServices(!allFilteredSelected)}
                                aria-label="Seleccionar servicios visibles"
                              />
                            </th>
                            <th>Servicio</th>
                            <th className="col-category">Categoría</th>
                            <th className="col-duration">Duración</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredServices.map(service => {
                            const serviceColor = getServiceColor(service);
                            const isSelected = formData.service_ids.includes(service.id);
                            const categoryName = getCategoryName(service.category_id);

                            return (
                              <tr
                                key={service.id}
                                className={isSelected ? 'is-selected' : ''}
                                style={{
                                  background: isSelected ? `${serviceColor}14` : undefined,
                                }}
                                onClick={() => toggleService(service.id)}
                              >
                                <td className="col-check" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleService(service.id)}
                                    aria-label={`Seleccionar ${service.name}`}
                                  />
                                </td>
                                <td>
                                  <div className="service-picker-service-cell">
                                    <div
                                      className="service-picker-icon"
                                      style={{ background: `${serviceColor}20` }}
                                    >
                                      <span className="material-symbols-outlined" style={{ color: serviceColor, fontSize: '18px' }}>spa</span>
                                    </div>
                                    <span className="service-picker-name">{service.name}</span>
                                  </div>
                                </td>
                                <td className="col-category">
                                  <span
                                    className="service-picker-category-badge"
                                    style={{
                                      background: `${serviceColor}18`,
                                      color: serviceColor,
                                    }}
                                  >
                                    {categoryName}
                                  </span>
                                </td>
                                <td className="col-duration">{service.duration_minutes} min</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear profesional'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingAdmin ? 'Editar administrador' : 'Nuevo administrador'}</h2>
            <form onSubmit={handleAdminSubmit}>
              <div className="form-group">
                <label>Nombre completo *</label>
                <input type="text" value={adminForm.full_name} onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Usuario *</label>
                  <input type="text" value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} required autoComplete="off" />
                </div>
                <div className="form-group">
                  <label>Correo *</label>
                  <input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>{editingAdmin ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</label>
                <PasswordInput
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  required={!editingAdmin}
                  autoComplete="new-password"
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', cursor: 'pointer', fontWeight: 500, color: 'var(--on-surface)' }}>
                <input type="checkbox" checked={adminForm.active} onChange={(e) => setAdminForm({ ...adminForm, active: e.target.checked })} />
                Cuenta activa
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdminModal(false)} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editingAdmin ? 'Guardar cambios' : 'Crear administrador'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
