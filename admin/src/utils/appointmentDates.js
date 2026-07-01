import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/** Normaliza appointment_date a YYYY-MM-DD sin depender de zona horaria. */
export function getAppointmentDateKey(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (str.includes('T')) return str.split('T')[0];
  if (str.includes(' ')) return str.split(' ')[0];
  return str.slice(0, 10);
}

export function parseAppointmentDate(value) {
  const key = getAppointmentDateKey(value);
  if (!key) return null;
  return parseISO(key);
}

export function formatAppointmentDate(value, pattern = 'dd/MM/yyyy') {
  const date = parseAppointmentDate(value);
  if (!date) return '—';
  return format(date, pattern, { locale: es });
}

export function formatAppointmentDateTime(value, time) {
  const dateLabel = formatAppointmentDate(value, "EEEE d 'de' MMMM, yyyy");
  const timeLabel = (time || '').slice(0, 5);
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
}

export function dedupeAppointments(list) {
  const map = new Map();
  (list || []).forEach((apt) => {
    if (apt?.id != null) {
      map.set(apt.id, apt);
    }
  });
  return [...map.values()];
}
