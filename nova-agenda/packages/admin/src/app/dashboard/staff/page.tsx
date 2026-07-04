'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Client, Service, StaffMember } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const PLAN_LEVELS: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2 };

type StaffForm = {
  name: string;
  email: string;
  phone: string;
  title: string;
  bio: string;
  color: string;
  avatarUrl: string;
  isActive: boolean;
  serviceIds: string[];
};

const emptyForm: StaffForm = {
  name: '',
  email: '',
  phone: '',
  title: '',
  bio: '',
  color: '#2dd4bf',
  avatarUrl: '',
  isActive: true,
  serviceIds: [],
};

export default function StaffPage() {
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.clientId) loadData();
    else setLoading(false);
  }, [user]);

  async function loadData() {
    try {
      const clientData = await api.getClient(user!.clientId!);
      setClient(clientData);

      if ((PLAN_LEVELS[clientData.plan] ?? 0) < PLAN_LEVELS.BASIC) {
        setLoading(false);
        return;
      }

      const [staffData, servicesData] = await Promise.all([
        api.getStaff(),
        api.getServices(),
      ]);
      setStaff(staffData);
      setServices(servicesData.filter((s) => s.isActive));
    } catch (error: unknown) {
      console.error(error);
      setMessage('Error: ' + (error instanceof Error ? error.message : 'No se pudo cargar el personal'));
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage('');
  }

  function openEdit(member: StaffMember) {
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      title: member.title || '',
      bio: member.bio || '',
      color: member.color || '#2dd4bf',
      avatarUrl: member.avatarUrl || '',
      isActive: member.isActive,
      serviceIds: member.services?.map((s) => s.serviceId || s.service?.id || '').filter(Boolean) || [],
    });
    setShowForm(true);
    setMessage('');
  }

  function toggleService(serviceId: string) {
    setForm((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((id) => id !== serviceId)
        : [...prev.serviceIds, serviceId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      title: form.title || null,
      bio: form.bio || null,
      color: form.color,
      avatarUrl: form.avatarUrl || null,
      isActive: form.isActive,
      serviceIds: form.serviceIds,
    };

    try {
      if (editing) {
        const updated = await api.updateStaff(editing.id, payload);
        setStaff((prev) => prev.map((s) => (s.id === editing.id ? updated : s)));
      } else {
        const created = await api.createStaff(payload);
        setStaff((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      setMessage(editing ? 'Personal actualizado' : 'Personal agregado');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(member: StaffMember) {
    try {
      const updated = await api.toggleStaff(member.id);
      setStaff((prev) => prev.map((s) => (s.id === member.id ? updated : s)));
    } catch (err: unknown) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'No se pudo cambiar el estado'));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar a este miembro del personal?')) return;
    try {
      await api.deleteStaff(id);
      setStaff((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'No se pudo eliminar'));
    }
  }

  const hasAccess = (PLAN_LEVELS[client?.plan || 'FREE'] ?? 0) >= PLAN_LEVELS.BASIC;

  if (loading) {
    return <div className="glass-card rounded-xl h-64 animate-pulse" />;
  }

  if (!user?.clientId) {
    return (
      <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant text-center">
        <p className="font-body-md text-on-surface-variant">Inicia sesión con una cuenta de negocio.</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="space-y-gutter">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Personal</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Agrega quién atiende las citas en tu negocio
          </p>
        </div>
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center mx-auto mb-lg text-primary">
            <span className="material-symbols-outlined text-4xl">badge</span>
          </div>
          <h3 className="font-headline-md text-on-surface mb-2">Disponible en plan Profesional</h3>
          <p className="font-body-sm text-on-surface-variant mb-lg">
            Gestiona estilistas, terapeutas u otro personal, asígnales servicios y deja que tus clientes elijan quién los atiende.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90"
          >
            Mejorar a Profesional
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Personal</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Personas que atienden citas. Tus clientes podrán elegirlos al reservar.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-on-primary px-md py-2.5 rounded-lg font-label-md font-bold shadow-lg shadow-primary/20 hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
          Agregar personal
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            message.startsWith('Error')
              ? 'bg-error-container text-on-error-container'
              : 'bg-secondary-container text-on-secondary-container'
          }`}
        >
          <span className="material-symbols-outlined">
            {message.startsWith('Error') ? 'error' : 'check_circle'}
          </span>
          <p className="font-body-sm">{message}</p>
        </div>
      )}

      {showForm && (
        <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant shadow-sm">
          <h3 className="font-headline-md text-on-surface mb-lg">
            {editing ? 'Editar personal' : 'Nuevo personal'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Nombre *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                placeholder="Ej: Ana López"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Cargo / especialidad</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                placeholder="Ej: Estilista, Terapeuta, Médico"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Correo</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">Color en agenda</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-12 h-12 border border-outline-variant rounded-lg cursor-pointer"
                />
                <span className="font-label-sm text-on-surface-variant">{form.color}</span>
              </div>
            </div>
            <div>
              <label className="font-label-md text-on-surface mb-xs block">URL de foto (opcional)</label>
              <input
                value={form.avatarUrl}
                onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>
            <div className="md:col-span-2">
              <label className="font-label-md text-on-surface mb-xs block">Biografía breve</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={2}
                placeholder="Experiencia, especialidades..."
                className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label className="font-label-md text-on-surface mb-sm block">Servicios que atiende</label>
              <p className="font-body-sm text-on-surface-variant mb-3">
                Si no eliges ninguno, podrá atender todos los servicios.
              </p>
              {services.length === 0 ? (
                <p className="font-body-sm text-on-surface-variant">
                  No hay servicios activos.{' '}
                  <Link href="/dashboard/services" className="text-primary font-bold hover:underline">
                    Crear servicios
                  </Link>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => {
                    const selected = form.serviceIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service.id)}
                        className={`px-3 py-2 rounded-lg border font-label-sm transition-all ${
                          selected
                            ? 'border-primary bg-primary-container/30 text-primary font-bold'
                            : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                        }`}
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: service.color }}
                        />
                        {service.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="font-label-md text-on-surface">Activo (visible para reservar)</span>
              </label>
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-lg py-3 border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
        {staff.map((member) => (
          <div
            key={member.id}
            className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden"
          >
            <div className="p-xl">
              <div className="flex items-start gap-3 mb-md">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 overflow-hidden"
                  style={{ backgroundColor: member.color }}
                >
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-lg">{member.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-headline-md text-on-surface truncate">{member.name}</h3>
                  {member.title && (
                    <p className="font-body-sm text-on-surface-variant">{member.title}</p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    member.isActive
                      ? 'bg-secondary-container/30 text-on-secondary-container'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {member.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {member.bio && (
                <p className="font-body-sm text-on-surface-variant mb-md line-clamp-2">{member.bio}</p>
              )}

              <div className="flex flex-wrap gap-1 mb-md">
                {member.services && member.services.length > 0 ? (
                  member.services.map((s) => (
                    <span
                      key={s.serviceId}
                      className="text-xs px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant"
                    >
                      {s.service?.name || 'Servicio'}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-on-surface-variant">Todos los servicios</span>
                )}
              </div>

              <p className="font-body-sm text-on-surface-variant mb-md">
                {member._count?.bookings || 0} citas asignadas
              </p>

              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggle(member)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    member.isActive
                      ? 'bg-surface-container-high text-on-surface-variant'
                      : 'bg-primary text-on-primary'
                  }`}
                >
                  {member.isActive ? 'Desactivar' : 'Activar'}
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(member)}
                    className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="p-2 hover:bg-error-container rounded-lg text-on-surface-variant hover:text-error"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {staff.length === 0 && !showForm && (
          <div className="col-span-full bg-surface-container-lowest p-xl rounded-xl border border-outline-variant text-center">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">group</span>
            <h3 className="font-headline-md text-on-surface mb-sm">Sin personal aún</h3>
            <p className="font-body-md text-on-surface-variant mb-lg">
              Agrega a quienes atienden citas. Aparecerán en el formulario público de reservas.
            </p>
            <button
              onClick={openCreate}
              className="px-lg py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90"
            >
              Agregar primer miembro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
