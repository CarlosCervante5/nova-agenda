import { PrismaClient, Prisma } from '@prisma/client';
import { timeToMinutes } from '../utils/date-only';

export type HoursDay = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
};

export const DEFAULT_WORKING_HOURS: HoursDay[] = [
  { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 2, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 3, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 4, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 5, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 6, openTime: '10:00', closeTime: '14:00', isOpen: true },
  { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isOpen: false },
];

const TIME_RE = /^\d{2}:\d{2}$/;

export function normalizeHourRows(raw: unknown): HoursDay[] {
  const list = Array.isArray(raw) ? raw : [];
  const byDay = new Map<number, HoursDay>();
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const dayOfWeek = Number((row as HoursDay).dayOfWeek);
    if (dayOfWeek < 0 || dayOfWeek > 6) continue;
    const openTime = TIME_RE.test(String((row as HoursDay).openTime)) ? String((row as HoursDay).openTime) : '09:00';
    const closeTime = TIME_RE.test(String((row as HoursDay).closeTime)) ? String((row as HoursDay).closeTime) : '18:00';
    byDay.set(dayOfWeek, {
      dayOfWeek,
      openTime,
      closeTime,
      isOpen: Boolean((row as HoursDay).isOpen),
    });
  }
  return DEFAULT_WORKING_HOURS.map((d) => byDay.get(d.dayOfWeek) ?? { ...d });
}

export function isWithinOpenHours(hours: HoursDay | null | undefined, startMin: number, endMin: number) {
  if (!hours || !hours.isOpen) return false;
  const open = timeToMinutes(hours.openTime);
  const close = timeToMinutes(hours.closeTime);
  return startMin >= open && endMin <= close;
}

type Db = PrismaClient | Prisma.TransactionClient;

export async function resolveHoursForDay(
  db: Db,
  input: { clientId: string; serviceId: string; useCustomHours: boolean; dayOfWeek: number }
): Promise<HoursDay | null> {
  if (input.useCustomHours) {
    const custom = await db.serviceWorkingHours.findUnique({
      where: { serviceId_dayOfWeek: { serviceId: input.serviceId, dayOfWeek: input.dayOfWeek } },
    });
    return custom;
  }

  const general = await db.workingHours.findUnique({
    where: { clientId_dayOfWeek: { clientId: input.clientId, dayOfWeek: input.dayOfWeek } },
  });
  return general ?? DEFAULT_WORKING_HOURS.find((h) => h.dayOfWeek === input.dayOfWeek) ?? null;
}

export async function syncServiceHours(db: Db, serviceId: string, hours: unknown) {
  const rows = normalizeHourRows(hours);
  await db.serviceWorkingHours.deleteMany({ where: { serviceId } });
  await db.serviceWorkingHours.createMany({
    data: rows.map((row) => ({ ...row, serviceId })),
  });
}
