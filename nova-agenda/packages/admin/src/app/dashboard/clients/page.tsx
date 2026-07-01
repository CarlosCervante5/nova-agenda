'use client';

import { useEffect, useState } from 'react';
import { api, Client } from '@/lib/api';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', email: '', phone: '', primaryColor: '#5950b6', plan: 'FREE' });

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    try { setClients(await api.getClients()); } finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) { await api.updateClient(editing.id, form); }
      else { await api.createClient(form); }
      setShowForm(false); setEditing(null);
      setForm({ name: '', slug: '', email: '', phone: '', primaryColor: '#5950b6', plan: 'FREE' });
      loadClients();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente?')) return;
    await api.deleteClient(id);
    loadClients();
  }

  function startEdit(client: Client) {
    setEditing(client);
    setForm({ name: client.name, slug: client.slug, email: client.email || '', phone: client.phone || '', primaryColor: client.primaryColor, plan: client.plan });
    setShowForm(true);
  }

  if (loading) {
    return (
      <div className="space-y-gutter animate-pulse">
        <div className="glass-card rounded-xl h-12" />
        <div className="glass-card rounded-xl h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Negocios</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Gestiona los {clients.length} negocios registrados.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', slug: '', email: '', phone: '', primaryColor: '#5950b6', plan: 'FREE' }); }}
          className="flex items-center gap-2 bg-primary text-on-primary px-md py-2.5 rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Agregar Negocio
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-lg">{editing ? 'Editar Negocio' : 'Nuevo Negocio'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Nombre del Negocio *</label>
              <input placeholder="Ej: Lumina Spa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" required />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">URL Slug *</label>
              <input placeholder="Ej: lumina-spa" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" required />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Correo Electrónico</label>
              <input type="email" placeholder="contacto@negocio.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Teléfono</label>
              <input placeholder="+1 (555) 000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Color de Marca</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-12 h-12 border border-outline-variant rounded-lg cursor-pointer" />
                <span className="font-label-sm text-label-sm text-on-surface-variant">{form.primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface mb-xs block">Plan</label>
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                <option value="FREE">Gratis</option>
                <option value="BASIC">Básico</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Empresa</option>
              </select>
            </div>
            <div className="col-span-full flex gap-3 pt-md">
              <button type="submit" className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all">{editing ? 'Actualizar Negocio' : 'Crear Negocio'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-lg py-3 border border-outline-variant text-on-surface rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-all">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-lg py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Nombre</th>
                <th className="px-lg py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Plan</th>
                <th className="px-lg py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Servicios</th>
                <th className="px-lg py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Citas</th>
                <th className="px-lg py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Estado</th>
                <th className="px-lg py-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-background transition-colors group">
                  <td className="px-lg py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-on-primary font-bold" style={{ backgroundColor: client.primaryColor }}>
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-label-md text-label-md text-on-surface">{client.name}</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-lg py-4">
                    <span className="px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant rounded-full text-[10px] font-bold uppercase">{client.plan}</span>
                  </td>
                  <td className="px-lg py-4 font-body-sm text-body-sm">{client._count?.services || 0}</td>
                  <td className="px-lg py-4 font-body-sm text-body-sm">{client._count?.bookings || 0}</td>
                  <td className="px-lg py-4">
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase w-fit ${client.isActive ? 'bg-secondary-container/30 text-on-secondary-container' : 'bg-error-container/30 text-on-error-container'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${client.isActive ? 'bg-secondary' : 'bg-error'}`} />
                      {client.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-lg py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(client)} className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                      <button onClick={() => handleDelete(client.id)} className="p-2 hover:bg-error-container rounded-lg text-on-surface-variant hover:text-error transition-colors"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-lg py-4 bg-surface-container-low flex justify-between items-center">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Mostrando {clients.length} de {clients.length} negocios</p>
        </div>
      </div>
    </div>
  );
}
