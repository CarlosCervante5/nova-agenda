'use client';

import { useEffect, useState } from 'react';
import { api, Service } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ServicesPage() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', description: '', duration: '30', price: '', color: '#5950b6', clientId: '' });

  useEffect(() => { loadServices(); }, []);

  async function loadServices() {
    try { setServices(await api.getServices()); } finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = { ...form, duration: Number(form.duration), price: form.price ? Number(form.price) : undefined };
      if (editing) { await api.updateService(editing.id, data); }
      else { await api.createService(data); }
      setShowForm(false); setEditing(null);
      setForm({ name: '', description: '', duration: '30', price: '', color: '#5950b6', clientId: '' });
      loadServices();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este servicio?')) return;
    await api.deleteService(id);
    loadServices();
  }

  async function toggleActive(service: Service) {
    await api.updateService(service.id, { isActive: !service.isActive });
    loadServices();
  }

  function startEdit(service: Service) {
    setEditing(service);
    setForm({ name: service.name, description: service.description || '', duration: String(service.duration), price: service.price ? String(service.price) : '', color: service.color, clientId: service.clientId });
    setShowForm(true);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter animate-pulse">
        {[1,2,3].map(i => <div key={i} className="glass-card rounded-xl h-48" />)}
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Servicios</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Configura tu menú de servicios y precios</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', description: '', duration: '30', price: '', color: '#5950b6', clientId: '' }); }}
          className="flex items-center gap-2 bg-primary text-on-primary px-md py-2.5 rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Agregar Servicio
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg">{editing ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Nombre del Servicio *</label>
              <input placeholder="Ej: Masaje Aromaterapéutico" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" required />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Duración (minutos) *</label>
              <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" min="5" step="5" required />
            </div>
            <div className="md:col-span-2">
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" rows={3} placeholder="Describe el servicio..." />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Precio ($)</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" min="0" step="0.01" placeholder="Dejar vacío si es gratis" />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-12 h-12 border border-outline-variant rounded-lg cursor-pointer" />
                <span className="font-label-sm text-label-sm text-on-surface-variant">{form.color}</span>
              </div>
            </div>
            <div className="col-span-full flex gap-3 pt-md">
              <button type="submit" className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all">{editing ? 'Actualizar Servicio' : 'Crear Servicio'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-lg py-3 border border-outline-variant text-on-surface rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="p-lg font-label-sm text-label-sm text-on-surface-variant uppercase">Nombre</th>
                <th className="p-lg font-label-sm text-label-sm text-on-surface-variant uppercase">Duración</th>
                <th className="p-lg font-label-sm text-label-sm text-on-surface-variant uppercase">Precio</th>
                <th className="p-lg font-label-sm text-label-sm text-on-surface-variant uppercase">Estado</th>
                <th className="p-lg font-label-sm text-label-sm text-on-surface-variant uppercase text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="p-lg">
                    <div className="flex items-center gap-md">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-on-primary" style={{ backgroundColor: service.color }}>
                        <span className="material-symbols-outlined">spa</span>
                      </div>
                      <div>
                        <span className="font-label-md text-label-md text-on-surface block">{service.name}</span>
                        {service.description && <span className="font-body-sm text-body-sm text-on-surface-variant block">{service.description}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="p-lg font-body-sm text-body-sm text-on-surface-variant">{service.duration} Min</td>
                  <td className="p-lg font-label-md text-label-md text-on-surface">{service.price ? `$${service.price.toFixed(2)}` : 'Gratis'}</td>
                  <td className="p-lg">
                    <button onClick={() => toggleActive(service)}>
                      <span className={`px-3 py-1 rounded-full font-label-sm text-label-sm ${service.isActive ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {service.isActive ? 'Activo' : 'Oculto'}
                      </span>
                    </button>
                  </td>
                  <td className="p-lg text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(service)} className="text-primary hover:underline font-label-md text-label-md mr-md">Editar</button>
                      <button onClick={() => handleDelete(service.id)} className="text-on-surface-variant hover:text-error transition-colors"><span className="material-symbols-outlined">delete</span></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
