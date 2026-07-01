import { useState, useEffect } from 'react';
import api from '../api';

const defaultServiceForm = {
  name: '',
  description: '',
  duration_minutes: 60,
  price: 0,
  category_id: '',
};

const defaultCategoryForm = {
  name: '',
  description: '',
  icon: 'spa',
  color: '#7d7f3e',
  sort_order: 0,
};

const SERVICES_PAGE_SIZE = 12;

export default function Services() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(defaultServiceForm);
  const [categoryForm, setCategoryForm] = useState(defaultCategoryForm);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  const loadAll = async () => {
    await Promise.all([loadServices(), loadCategories()]);
  };

  const loadServices = async () => {
    const res = await api.get('/services');
    setServices(res.data);
  };

  const loadCategories = async () => {
    const res = await api.get('/categories');
    setCategories(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      category_id: formData.category_id ? Number(formData.category_id) : null,
    };

    if (editingService) {
      await api.put(`/services/${editingService.id}`, payload);
    } else {
      await api.post('/services', payload);
    }

    setShowModal(false);
    setEditingService(null);
    resetForm();
    loadAll();
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...categoryForm,
      sort_order: Number(categoryForm.sort_order) || 0,
    };

    if (editingCategory) {
      await api.put(`/categories/${editingCategory.id}`, payload);
    } else {
      await api.post('/categories', payload);
    }

    setShowCategoryModal(false);
    setEditingCategory(null);
    resetCategoryForm();
    loadAll();
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      duration_minutes: service.duration_minutes,
      price: service.price,
      category_id: service.category_id || '',
    });
    setShowModal(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || 'spa',
      color: category.color || '#7d7f3e',
      sort_order: category.sort_order || 0,
    });
    setShowCategoryModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    try {
      await api.delete(`/services/${id}`);
      loadAll();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo eliminar el servicio');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('¿Eliminar esta categoría? Los servicios quedarán sin categoría.')) return;
    try {
      await api.delete(`/categories/${id}`);
      loadAll();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo eliminar la categoría');
    }
  };

  const resetForm = () => setFormData(defaultServiceForm);
  const resetCategoryForm = () => setCategoryForm(defaultCategoryForm);

  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : 'Sin categoría';
  };

  const getServiceColor = (service) => {
    const cat = categories.find(c => c.id === service.category_id);
    return cat?.color || service.color || '#7d7f3e';
  };

  const filteredServices = services.filter(service => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query
      || service.name.toLowerCase().includes(query)
      || (service.description || '').toLowerCase().includes(query)
      || getCategoryName(service.category_id).toLowerCase().includes(query);
    const matchesCategory = !categoryFilter
      || String(service.category_id || '') === String(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / SERVICES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedServices = filteredServices.slice(
    (safePage - 1) * SERVICES_PAGE_SIZE,
    safePage * SERVICES_PAGE_SIZE
  );
  const rangeStart = filteredServices.length === 0 ? 0 : (safePage - 1) * SERVICES_PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * SERVICES_PAGE_SIZE, filteredServices.length);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Servicios</h1>
          <p className="subtitle">Organiza tratamientos por categoría para el booking público.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => { resetCategoryForm(); setShowCategoryModal(true); }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>category</span>
            Nueva categoría
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>add</span>
            Nuevo servicio
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '22px', marginBottom: '16px' }}>Categorías</h3>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {categories.map(category => (
            <div key={category.id} className="card" style={{ borderTop: `4px solid ${category.color}`, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: category.color }}>{category.icon || 'spa'}</span>
                    <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '18px' }}>{category.name}</h4>
                  </div>
                  {category.description && (
                    <p style={{ color: 'var(--on-surface-variant)', fontSize: '13px', marginBottom: '8px' }}>{category.description}</p>
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{category.services_count || 0} servicios</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => handleEditCategory(category)} style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--on-surface-variant)' }} title="Editar">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                  </button>
                  <button onClick={() => handleDeleteCategory(category.id)} style={{ padding: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error)' }} title="Eliminar">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p style={{ color: 'var(--on-surface-variant)' }}>Crea categorías para agrupar los servicios en el booking.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}>
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              type="search"
              placeholder="Buscar por nombre, descripción o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '12px 16px', border: 'none', borderRadius: '0.75rem', background: 'var(--surface-container)', fontSize: '14px', minWidth: '180px' }}
          >
            <option value="">Todas las categorías</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        {(search || categoryFilter) && (
          <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '13px', color: 'var(--on-surface-variant)' }}>
            {filteredServices.length} de {services.length} servicios
          </p>
        )}
      </div>

      {filteredServices.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--on-surface-variant)' }}>
            Mostrando {rangeStart}–{rangeEnd} de {filteredServices.length} servicios
          </p>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                style={{ padding: '8px 12px', minWidth: 'auto' }}
                aria-label="Página anterior"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
              </button>
              <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)', minWidth: '88px', textAlign: 'center' }}>
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                style={{ padding: '8px 12px', minWidth: 'auto' }}
                aria-label="Página siguiente"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {paginatedServices.map(service => {
          const serviceColor = getServiceColor(service);
          return (
          <div key={service.id} className="card" style={{ borderTop: `4px solid ${serviceColor}`, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '0.75rem',
                    background: serviceColor + '15',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span className="material-symbols-outlined" style={{ color: serviceColor }}>spa</span>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '20px', fontWeight: 500 }}>{service.name}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>{getCategoryName(service.category_id)}</p>
                  </div>
                </div>

                {service.description && (
                  <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '16px', lineHeight: '1.5' }}>
                    {service.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '24px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Duración</span>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '18px', fontWeight: 500 }}>{service.duration_minutes} min</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Precio</span>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '18px', fontWeight: 500, color: 'var(--primary)' }}>${service.price}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => handleEdit(service)} style={{ padding: '8px', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--on-surface-variant)' }} title="Editar">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                </button>
                <button onClick={() => handleDelete(service.id)} style={{ padding: '8px', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error)' }} title="Eliminar">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                </button>
              </div>
            </div>
          </div>
          );
        })}

        {services.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '64px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '64px', opacity: 0.2, color: 'var(--primary)', display: 'block', marginBottom: '16px' }}>spa</span>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '16px' }}>Aún no hay servicios. Crea el primero.</p>
          </div>
        )}

        {services.length > 0 && filteredServices.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.2, color: 'var(--primary)', display: 'block', marginBottom: '12px' }}>filter_list_off</span>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '16px' }}>No hay servicios que coincidan con los filtros.</p>
          </div>
        )}
      </div>

      {filteredServices.length > 0 && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            Anterior
          </button>
          <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)', padding: '0 8px' }}>
            Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            Siguiente
          </button>
        </div>
      )}

      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</h2>
            <form onSubmit={handleCategorySubmit}>
              <div className="form-group">
                <label>Nombre *</label>
                <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows="2" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Icono</label>
                  <select value={categoryForm.icon} onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}>
                    <option value="spa">Spa</option>
                    <option value="self_improvement">Terapia</option>
                    <option value="favorite">Corazón</option>
                    <option value="psychology">Mente</option>
                    <option value="fitness_center">Cuerpo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Orden</label>
                  <input type="number" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })} min="0" />
                </div>
              </div>
              <div className="form-group">
                <label>Color</label>
                <input type="color" value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} style={{ width: '48px', height: '48px', padding: 0, border: 'none', borderRadius: '0.75rem' }} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingCategory ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingService ? 'Editar servicio' : 'Nuevo servicio'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Categoría *</label>
                <select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} required>
                  <option value="">Seleccionar categoría...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Nombre del servicio *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="3" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Duración (minutos) *</label>
                  <input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })} min="15" step="15" required />
                </div>
                <div className="form-group">
                  <label>Precio ($)</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} min="0" step="0.01" />
                </div>
              </div>
              {formData.category_id && (
                <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginBottom: '8px' }}>
                  Color asignado automáticamente desde la categoría:{' '}
                  <span style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: getServiceColor({ category_id: Number(formData.category_id) }),
                    verticalAlign: 'middle',
                    marginRight: '6px',
                  }} />
                  {getCategoryName(Number(formData.category_id))}
                </p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingService ? 'Guardar cambios' : 'Crear servicio'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
