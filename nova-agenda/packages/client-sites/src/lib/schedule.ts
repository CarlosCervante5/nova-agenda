import { addDays, format, startOfWeek } from 'date-fns';
import { ClientInfo, getAvailableSlots } from './api';

type HoursRow = { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean };

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function hoursForService(
  client: ClientInfo,
  service: ClientInfo['services'][0] | null
): HoursRow[] {
  if (service?.useCustomHours && service.workingHours?.length) {
    return service.workingHours;
  }
  return client.workingHours || [];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Día con clase y con al menos un horario que aún no empieza. */
export function isDateBookable(date: Date, hours: HoursRow[], now = new Date()) {
  const row = hours.find((h) => h.dayOfWeek === date.getDay());
  if (!row?.isOpen) return false;

  const day = startOfDay(date);
  const today = startOfDay(now);
  if (day < today) return false;
  if (day.getTime() === today.getTime()) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (timeToMinutes(row.closeTime) <= nowMin) return false;
  }
  return true;
}

export function nextOpenDate(hours: HoursRow[], from = new Date()) {
  const start = startOfDay(from);

  for (let i = 0; i < 21; i++) {
    const date = addDays(start, i);
    if (isDateBookable(date, hours, from)) return date;
  }

  return start;
}

export function applyServiceSchedule(
  client: ClientInfo,
  service: ClientInfo['services'][0],
  setters: {
    setSelectedDate: (d: Date) => void;
    setWeekStart: (d: Date) => void;
    setSelectedSlot?: (s: string | null) => void;
  }
) {
  const date = nextOpenDate(hoursForService(client, service));
  setters.setSelectedDate(date);
  setters.setWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
  setters.setSelectedSlot?.(null);
}

/**
 * Si la fecha actual ya no tiene horarios (clase de hoy ya pasó),
 * busca el siguiente día con turnos reales en la API.
 */
export async function loadSlotsOrAdvance(params: {
  clientSlug: string;
  client: ClientInfo;
  service: ClientInfo['services'][0];
  selectedDate: Date;
}): Promise<{ date: Date; slots: string[]; advanced: boolean }> {
  const { clientSlug, client, service, selectedDate } = params;
  const hours = hoursForService(client, service);

  const slotsFor = async (date: Date) => {
    const data = await getAvailableSlots(clientSlug, service.id, format(date, 'yyyy-MM-dd'));
    return data.slots || [];
  };

  const currentSlots = await slotsFor(selectedDate);
  if (currentSlots.length > 0) {
    return { date: selectedDate, slots: currentSlots, advanced: false };
  }

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  if (selectedKey > todayKey) {
    return { date: selectedDate, slots: [], advanced: false };
  }

  for (let i = 1; i <= 21; i++) {
    const candidate = addDays(startOfDay(selectedDate), i);
    const row = hours.find((h) => h.dayOfWeek === candidate.getDay());
    if (row && !row.isOpen) continue;
    const slots = await slotsFor(candidate);
    if (slots.length > 0) {
      return { date: candidate, slots, advanced: true };
    }
  }

  return { date: selectedDate, slots: [], advanced: false };
}

export function emptySlotsMessage(isOpen: boolean, selectedDate: Date) {
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  if (!isOpen && isToday) {
    return 'La clase de hoy ya comenzó. Elige otro día disponible.';
  }
  if (!isOpen) {
    return 'Este servicio no se imparte este día. Elige un día disponible en el calendario.';
  }
  if (isToday) {
    return 'Ya no hay horarios disponibles hoy para este servicio. Elige otro día.';
  }
  return 'No hay horarios disponibles para esta fecha.';
}
