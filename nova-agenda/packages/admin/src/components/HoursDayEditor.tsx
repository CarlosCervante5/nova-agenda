'use client';

import { WorkingHoursEntry } from '@/lib/api';

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export const DEFAULT_HOURS: WorkingHoursEntry[] = DAY_ORDER.map((dayOfWeek) => ({
  dayOfWeek,
  openTime: dayOfWeek === 6 ? '10:00' : '09:00',
  closeTime: dayOfWeek === 6 ? '14:00' : '18:00',
  isOpen: dayOfWeek >= 1 && dayOfWeek <= 6,
}));

export function sortHours(hours: WorkingHoursEntry[]) {
  return [...hours].sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek));
}

export function normalizeHours(hours: WorkingHoursEntry[]) {
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  return DAY_ORDER.map((day) => byDay.get(day) ?? DEFAULT_HOURS.find((d) => d.dayOfWeek === day)!);
}

type Props = {
  hours: WorkingHoursEntry[];
  onChange: (hours: WorkingHoursEntry[]) => void;
};

export default function HoursDayEditor({ hours, onChange }: Props) {
  function updateDay(dayOfWeek: number, patch: Partial<WorkingHoursEntry>) {
    onChange(hours.map((entry) => (entry.dayOfWeek === dayOfWeek ? { ...entry, ...patch } : entry)));
  }

  return (
    <div className="space-y-3">
      {sortHours(hours).map((entry) => (
        <div
          key={entry.dayOfWeek}
          className={`grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 p-md rounded-lg border ${
            entry.isOpen ? 'border-outline-variant bg-surface-container-lowest' : 'border-outline-variant/50 bg-surface-container-low opacity-80'
          }`}
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={entry.isOpen}
              onChange={(e) => updateDay(entry.dayOfWeek, { isOpen: e.target.checked })}
              className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
            />
            <span className="font-label-md text-label-md text-on-surface">{DAY_LABELS[entry.dayOfWeek]}</span>
          </label>

          {entry.isOpen ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant">Abre</label>
                <input
                  type="time"
                  value={entry.openTime}
                  onChange={(e) => updateDay(entry.dayOfWeek, { openTime: e.target.value })}
                  className="px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm text-body-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant">Cierra</label>
                <input
                  type="time"
                  value={entry.closeTime}
                  onChange={(e) => updateDay(entry.dayOfWeek, { closeTime: e.target.value })}
                  className="px-3 py-2 bg-surface-bright border border-outline-variant rounded-lg font-body-sm text-body-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  required
                />
              </div>
            </div>
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant self-center">Cerrado</p>
          )}
        </div>
      ))}
    </div>
  );
}
