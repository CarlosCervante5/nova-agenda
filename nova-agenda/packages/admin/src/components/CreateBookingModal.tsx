'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api, Service, StaffMember } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialDate?: Date;
  clientPlan?: string;
}

const PLAN_LEVELS: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2 };

export default function CreateBookingModal({
  open,
  onClose,
  onCreated,
  initialDate,
  clientPlan = 'FREE',
}: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    serviceId: '',
    staffId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    date: format(initialDate || new Date(), 'yyyy-MM-dd'),
    startTime: '10:00',
    notes: '',
    enrollLoyalty: false,
  });

  const canLoyaltyPhone = (PLAN_LEVELS[clientPlan] ?? 0) >= PLAN_LEVELS.BASIC;
  const canStaff = (PLAN_LEVELS[clientPlan] ?? 0) >= PLAN_LEVELS.BASIC;

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      date: format(initialDate || new Date(), 'yyyy-MM-dd'),
    }));
    loadOptions();
  }, [open, initialDate]);

  async function loadOptions() {
    setLoading(true);
    setError('');
    try {
      const servicesData = await api.getServices();
      const active = servicesData.filter((s) => s.isActive);
      setServices(active);

      if (canStaff) {
        try {
          const staffData = await api.getStaff();
          setStaff(staffData.filter((s) => s.isActive));
        } catch {
          setStaff([]);
        }
      } else {
        setStaff([]);
      }

      setForm((prev) => ({
        ...prev,
        serviceId: prev.serviceId || active[0]?.id || '',
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar servicios');
    } finally {
      setLoading(false);
    }
  }

  const staffForService = staff.filter((s) => {
    if (!form.serviceId) return true;
    const ids = s.services?.map((x) => x.serviceId || x.service?.id).filter(Boolean) || [];
    return ids.length === 0 || ids.includes(form.serviceId);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createAdminBooking({
        serviceId: form.serviceId,
        staffId: form.staffId || undefined,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim() || undefined,
        customerEmail: form.customerEmail.trim() || undefined,
        date: form.date,
        startTime: form.startTime,
        notes: form.notes.trim() || undefined,
      });

      if (canLoyaltyPhone && form.enrollLoyalty && form.customerPhone.trim()) {
        try {
          await api.createLoyaltyCardAdmin({
            customerName: form.customerName.trim(),
            customerPhone: form.customerPhone.trim(),
            customerEmail: form.customerEmail.trim() || undefined,
          });
        } catch {
          // La cita ya se creó; la tarjeta es opcional
        }
      }

      onCreated();
      onClose();
      setForm({
        serviceId: services[0]?.id || '',
        staffId: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '10:00',
        notes: '',
        enrollLoyalty: false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cita');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-lg py-md border-b border-outline-variant flex items-center justify-between sticky top-0 bg-surface-container-lowest">
          <h3 className="font-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">event_available</span>
            Nueva cita
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-container-high">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="p-xl flex justify-center">
            <div className="animate-spin h-8 w-8 border-[3px] border-primary-container border-t-primary rounded-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-lg space-y-md">
            {error && (
              <div className="p-3 rounded-lg bg-error-container text-on-error-container font-body-sm">{error}</div>
            )}

            {services.length === 0 ? (
              <p className="font-body-sm text-on-surface-variant">
                Primero crea al menos un servicio en el menú Servicios.
              </p>
            ) : (
              <>
                <div>
                  <label className="font-label-md text-on-surface mb-xs block">Servicio *</label>
                  <select
                    required
                    value={form.serviceId}
                    onChange={(e) => setForm({ ...form, serviceId: e.target.value, staffId: '' })}
                    className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.duration} min)
                      </option>
                    ))}
                  </select>
                </div>

                {canStaff && staffForService.length > 0 && (
                  <div>
                    <label className="font-label-md text-on-surface mb-xs block">Personal (opcional)</label>
                    <select
                      value={form.staffId}
                      onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                    >
                      <option value="">Sin asignar</option>
                      {staffForService.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.title ? ` · ${s.title}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <div>
                    <label className="font-label-md text-on-surface mb-xs block">Fecha *</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="font-label-md text-on-surface mb-xs block">Hora *</label>
                    <input
                      type="time"
                      required
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-label-md text-on-surface mb-xs block">Nombre del cliente *</label>
                  <input
                    required
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                    placeholder="Nombre completo"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <div>
                    <label className="font-label-md text-on-surface mb-xs block">Teléfono</label>
                    <input
                      type="tel"
                      value={form.customerPhone}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                      placeholder="+52..."
                    />
                  </div>
                  <div>
                    <label className="font-label-md text-on-surface mb-xs block">Correo</label>
                    <input
                      type="email"
                      value={form.customerEmail}
                      onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {canLoyaltyPhone && (
                  <label className="flex items-start gap-3 p-md rounded-lg border border-outline-variant bg-surface-container-low cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enrollLoyalty}
                      onChange={(e) => setForm({ ...form, enrollLoyalty: e.target.checked })}
                      className="mt-1"
                      disabled={!form.customerPhone.trim()}
                    />
                    <div>
                      <span className="font-label-md text-on-surface block">Registrar en fidelidad</span>
                      <span className="font-body-sm text-on-surface-variant">
                        Crea la tarjeta virtual con este teléfono para que el cliente consulte sellos en el portal.
                      </span>
                    </div>
                  </label>
                )}

                <div>
                  <label className="font-label-md text-on-surface mb-xs block">Notas</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-surface-bright border border-outline-variant rounded-lg font-body-md outline-none focus:border-primary"
                  />
                </div>

                <div className="flex gap-3 pt-sm">
                  <button
                    type="submit"
                    disabled={saving || !form.serviceId}
                    className="flex-1 py-3 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Agendar cita'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-lg py-3 border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
