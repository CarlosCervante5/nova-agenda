'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ServiceCategory } from '@/lib/api';

interface Props {
  enabled: boolean;
  onChange?: () => void;
}

export default function ServiceCategoriesPanel({ enabled, onChange }: Props) {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: '#2dd4bf',
    parentId: '',
  });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (enabled) loadCategories();
    else setLoading(false);
  }, [enabled]);

  async function loadCategories() {
    try {
      setLoading(true);
      const data = await api.getServiceCategories();
      setCategories(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate(parentId = '') {
    setEditing(null);
    setForm({ name: '', description: '', color: '#2dd4bf', parentId });
    setShowForm(true);
    setMessage('');
  }

  function openEdit(cat: ServiceCategory) {
    setEditing(cat);
    setForm({
      name: cat.name,
      description: cat.description || '',
      color: cat.color || '#2dd4bf',
      parentId: cat.parentId || '',
    });
    setShowForm(true);
    setMessage('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        color: form.color,
        parentId: form.parentId || null,
      };
      if (editing) {
        await api.updateServiceCategory(editing.id, payload);
      } else {
        await api.createServiceCategory(payload);
      }
      setShowForm(false);
      setEditing(null);
      await loadCategories();
      onChange?.();
      setMessage(editing ? 'Categoría actualizada' : 'Categoría creada');
      setTimeout(() => setMessage(''), 2500);
    } catch (err: unknown) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta categoría? Los servicios quedarán sin categoría.')) return;
    try {
      await api.deleteServiceCategory(id);
      await loadCategories();
      onChange?.();
    } catch (err: unknown) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'No se pudo eliminar'));
    }
  }

  if (!enabled) {
    return (
      <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant flex flex-col sm:flex-row sm:items-center gap-md">
        <div className="flex-1">
          <h3 className="font-headline-md text-on-surface mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">category</span>
            Categorías de servicios
          </h3>
          <p className="font-body-sm text-on-surface-variant">
            Agrupa y anida tipos de productos o servicios (ej. Cabello → Cortes, Color). Disponible en plan Profesional.
          </p>
        </div>
        <Link
          href="/dashboard/billing"
          className="px-lg py-2.5 bg-primary text-on-primary rounded-lg font-label-md font-bold text-center hover:opacity-90"
        >
          Mejorar plan
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="glass-card rounded-xl h-32 animate-pulse" />;
  }

  const rootCategories = categories;

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">category</span>
            Categorías de servicios
          </h3>
          <p className="font-body-sm text-on-surface-variant">
            Organiza servicios en categorías y subcategorías (hasta 2 niveles)
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="px-md py-2 bg-primary text-on-primary rounded-lg font-label-sm font-bold hover:opacity-90"
        >
          + Categoría
        </button>
      </div>

      <div className="p-lg space-y-md">
        {message && (
          <div
            className={`p-3 rounded-lg font-body-sm ${
              message.startsWith('Error')
                ? 'bg-error-container text-on-error-container'
                : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            {message}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="p-md rounded-xl border border-outline-variant bg-surface-container-low grid grid-cols-1 md:grid-cols-2 gap-md">
            <div>
              <label className="font-label-sm text-on-surface-variant mb-1 block">Nombre *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
                placeholder="Ej: Cabello, Uñas, Masajes"
              />
            </div>
            <div>
              <label className="font-label-sm text-on-surface-variant mb-1 block">Categoría padre (opcional)</label>
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                disabled={!!editing?.children?.length}
                className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">Ninguna (categoría principal)</option>
                {rootCategories
                  .filter((c) => c.id !== editing?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-on-surface-variant mt-1">
                Elige un padre para crear una subcategoría anidada
              </p>
            </div>
            <div>
              <label className="font-label-sm text-on-surface-variant mb-1 block">Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-12 h-10 border border-outline-variant rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <label className="font-label-sm text-on-surface-variant mb-1 block">Descripción</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm outline-none focus:border-primary"
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-md py-2 bg-primary text-on-primary rounded-lg font-label-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-md py-2 border border-outline-variant rounded-lg font-label-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {rootCategories.length === 0 && !showForm ? (
          <p className="font-body-sm text-on-surface-variant text-center py-md">
            Aún no hay categorías. Crea una para agrupar tus servicios.
          </p>
        ) : (
          <div className="space-y-3">
            {rootCategories.map((cat) => (
              <div key={cat.id} className="rounded-xl border border-outline-variant overflow-hidden">
                <div className="flex items-center gap-3 p-md bg-surface-container-low">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-on-surface">{cat.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {cat._count?.services || 0} servicios · {cat.children?.length || 0} subcategorías
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreate(cat.id)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    + Subcategoría
                  </button>
                  <button type="button" onClick={() => openEdit(cat)} className="p-1 text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button type="button" onClick={() => handleDelete(cat.id)} className="p-1 text-on-surface-variant hover:text-error">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
                {cat.children && cat.children.length > 0 && (
                  <div className="divide-y divide-outline-variant">
                    {cat.children.map((child) => (
                      <div key={child.id} className="flex items-center gap-3 px-md py-sm pl-10">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: child.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-body-sm text-on-surface">{child.name}</p>
                          <p className="text-xs text-on-surface-variant">
                            {child._count?.services || 0} servicios
                          </p>
                        </div>
                        <button type="button" onClick={() => openEdit(child)} className="p-1 text-on-surface-variant hover:text-primary">
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button type="button" onClick={() => handleDelete(child.id)} className="p-1 text-on-surface-variant hover:text-error">
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
