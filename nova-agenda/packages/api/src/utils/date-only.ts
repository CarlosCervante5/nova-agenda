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
