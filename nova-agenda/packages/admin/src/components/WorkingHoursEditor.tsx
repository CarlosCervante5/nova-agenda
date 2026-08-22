'use client';

import { useEffect, useState } from 'react';
import { api, WorkingHoursEntry } from '@/lib/api';
import HoursDayEditor, { DEFAULT_HOURS, normalizeHours } from '@/components/HoursDayEditor';

interface Props {
  clientId: string;
}

const SLOT_GAP_OPTIONS = [5, 10, 15, 20] as const;

export default function WorkingHoursEditor({ clientId }: Props) {
  const [hours, setHours] = useState<WorkingHoursEntry[]>(DEFAULT_HOURS);
  const [slotGapMinutes, setSlotGapMinutes] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    loadHours();
  }, [clientId]);

  async function loadHours() {
    setLoading(true);
    try {
      const [data, client] = await Promise.all([
        api.getWorkingHours(clientId),
        api.getClient(clientId),
      ]);
      setHours(normalizeHours(data));
      const gap = client.slotGapMinutes ?? 10;
      setSlotGapMinutes(SLOT_GAP_OPTIONS.includes(gap as (typeof SLOT_GAP_OPTIONS)[number]) ? gap : 10);
    } catch (error) {
      console.error('Error loading working hours:', error);
      setHours(DEFAULT_HOURS);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const [updated] = await Promise.all([
        api.updateWorkingHours(clientId, hours),
        api.updateClient(clientId, { slotGapMinutes }),
      ]);
      setHours(normalizeHours(updated));
      setMessage('Horarios y espacio entre citas guardados');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'No se pudieron guardar los horarios'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-lg py-md flex items-center justify-between bg-surface-container-low hover:bg-surface-container-high/50 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <span className="material-symbols-outlined text-primary">schedule</span>
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">Horarios de atención</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Horario general del negocio. Un servicio puede sustituirlo con el suyo.
            </p>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {expanded && (
        <form onSubmit={handleSave} className="p-lg border-t border-outline-variant">
          {loading ? (
            <div className="py-8 flex justify-center">
              <div className="animate-spin h-8 w-8 border-[3px] border-primary-container border-t-primary rounded-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-md rounded-lg border border-outline-variant bg-surface-container-low mb-md">
                <label className="font-label-md text-on-surface mb-2 block">
                  Espacio entre citas
                </label>
                <p className="font-body-sm text-on-surface-variant mb-3">
                  Tiempo libre después de cada cita antes de la siguiente (limpieza, preparación, etc.)
                </p>
                <div className="flex flex-wrap gap-2">
                  {SLOT_GAP_OPTIONS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setSlotGapMinutes(mins);
                        setMessage('');
                      }}
                      className={`px-4 py-2 rounded-lg border font-label-md font-bold transition-all ${
                        slotGapMinutes === mins
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-outline-variant text-on-surface hover:border-primary/40'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              <HoursDayEditor
                hours={hours}
                onChange={(next) => {
                  setHours(next);
                  setMessage('');
                }}
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-lg pt-lg border-t border-outline-variant">
            <button
              type="submit"
              disabled={saving || loading}
              className="px-lg py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
            {message && (
              <p className={`font-body-sm text-body-sm ${message.startsWith('Error') ? 'text-error' : 'text-secondary'}`}>
                {message}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
