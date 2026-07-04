/** Parse yyyy-MM-dd as local calendar date (avoids UTC timezone shift). */
export function parseDateOnly(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { start, end, dayOfWeek: start.getDay() };
}

export function bookingStorageDate(dateStr: string) {
  const { start } = parseDateOnly(dateStr);
  return start;
}

export function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(total: number) {
  const hours = String(Math.floor(total / 60)).padStart(2, '0');
  const mins = String(total % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

/** Valores permitidos de espacio entre citas (minutos). */
export const SLOT_GAP_OPTIONS = [5, 10, 15, 20] as const;

export function normalizeSlotGap(value: unknown, fallback = 10) {
  const n = Number(value);
  return (SLOT_GAP_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}

/**
 * ¿El intervalo [slotStart, slotEnd) choca con una cita existente,
 * incluyendo `gapMinutes` de espacio después de cada cita?
 */
export function slotConflictsWithBooking(
  slotStartMin: number,
  slotEndMin: number,
  bookingStart: string,
  bookingEnd: string,
  gapMinutes: number
) {
  const bStart = timeToMinutes(bookingStart);
  const bEnd = timeToMinutes(bookingEnd) + gapMinutes;
  return slotStartMin < bEnd && slotEndMin > bStart;
}
