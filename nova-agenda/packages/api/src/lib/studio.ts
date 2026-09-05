import { Prisma, PrismaClient } from '@prisma/client';
import {
  bookingStorageDate,
  minutesToTime,
  parseDateOnly,
  timeToMinutes,
  zonedNow,
} from '../utils/date-only';
import { resolveHoursForDay } from './working-hours';

const prisma = new PrismaClient();

type Db = Prisma.TransactionClient | PrismaClient;

export const CANCEL_HOURS = 3;
export const RESCHEDULE_HOURS = 8;
export const DEFAULT_CLASS_CAPACITY = 8;
export const DEFAULT_DROP_IN_PRICE = 140;

const PLAN_CREDITS: Record<string, number> = {
  START: 4,
  ELITE: 8,
  PREMIUM: 12,
  'PREMIUM +': 16,
  'PREMIUM+': 16,
  UNLIMITED: 30,
};

export function isStudioClient(client: { studioBooking: boolean; slug: string }) {
  return client.studioBooking || client.slug.toLowerCase() === 'wellness-club';
}

export function creditsForPlan(plan: { name: string; classesPerPeriod: number }) {
  if (plan.classesPerPeriod > 0) return plan.classesPerPeriod;
  return PLAN_CREDITS[plan.name.trim().toUpperCase()] || 0;
}

export function normalizePhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.slice(-10);
}

export function emailsMatch(a?: string | null, b?: string | null) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  return Boolean(left && right && left === right);
}

export function hoursUntilClass(dateStr: string, startTime: string) {
  const now = zonedNow();
  const [y1, m1, d1] = now.dateStr.split('-').map(Number);
  const [y2, m2, d2] = dateStr.split('-').map(Number);
  const days = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  return days * 24 + (timeToMinutes(startTime) - now.minutes) / 60;
}

export function formatDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sameCustomer(
  record: { customerEmail?: string | null; customerPhone?: string | null },
  email?: string | null,
  phone?: string | null
) {
  const phoneKey = normalizePhone(phone);
  return (
    emailsMatch(record.customerEmail, email) ||
    (phoneKey.length >= 10 && normalizePhone(record.customerPhone) === phoneKey)
  );
}

export async function findStudioClient(slug: string) {
  return prisma.client.findUnique({
    where: { slug, isActive: true },
  });
}

export async function ensurePurchaseCredits(
  db: Db,
  purchase: {
    id: string;
    creditsTotal: number;
    status: string;
    plan: { name: string; classesPerPeriod: number };
  }
) {
  if (purchase.status !== 'ACTIVE') return purchase;
  const granted = creditsForPlan(purchase.plan);
  if (purchase.creditsTotal > 0 || granted <= 0) return purchase;
  return db.membershipPurchase.update({
    where: { id: purchase.id },
    data: { creditsTotal: granted, creditsUsed: 0 },
  });
}

export async function findActivePurchases(
  db: Db,
  clientId: string,
  email?: string | null,
  phone?: string | null
) {
  const now = new Date();
  const purchases = await db.membershipPurchase.findMany({
    where: {
      clientId,
      status: 'ACTIVE',
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: now } }],
    },
    include: { plan: true },
    orderBy: { createdAt: 'asc' },
  });

  const matched = [];
  for (const purchase of purchases) {
    if (!sameCustomer(purchase, email, phone)) continue;
    const synced = await ensurePurchaseCredits(db, purchase);
    matched.push({ ...purchase, ...synced, plan: purchase.plan });
  }
  return matched;
}

export function creditsFromPurchases(
  purchases: { id: string; creditsTotal: number; creditsUsed: number; plan: { name: string }; currentPeriodEnd: Date | null }[]
) {
  const remaining = purchases.map((p) => ({
    ...p,
    left: Math.max(0, p.creditsTotal - p.creditsUsed),
  }));
  const creditsLeft = remaining.reduce((sum, p) => sum + p.left, 0);
  const creditsTotal = remaining.reduce((sum, p) => sum + p.creditsTotal, 0);
  const current = remaining.find((p) => p.left > 0) || remaining[0] || null;
  return {
    creditsLeft,
    creditsTotal,
    planName: current?.plan.name || null,
    validUntil: current?.currentPeriodEnd || null,
    purchaseId: remaining.find((p) => p.left > 0)?.id || null,
  };
}

export async function pickPurchaseWithCredit(
  db: Db,
  clientId: string,
  email?: string | null,
  phone?: string | null
) {
  const purchases = await findActivePurchases(db, clientId, email, phone);
  return purchases.find((p) => p.creditsTotal - p.creditsUsed > 0) || null;
}

export async function countClassBookings(
  db: Db,
  params: { clientId: string; serviceId: string; dateStr: string; startTime: string; excludeId?: string }
) {
  const { start, end } = parseDateOnly(params.dateStr);
  return db.booking.count({
    where: {
      clientId: params.clientId,
      serviceId: params.serviceId,
      date: { gte: start, lte: end },
      startTime: params.startTime,
      status: { not: 'CANCELLED' },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
  });
}

export async function classHasRoom(
  db: Db,
  params: {
    clientId: string;
    serviceId: string;
    dateStr: string;
    startTime: string;
    capacity: number;
    excludeId?: string;
  }
) {
  const taken = await countClassBookings(db, params);
  return { taken, remaining: Math.max(0, params.capacity - taken), full: taken >= params.capacity };
}

export async function hasUsedTrial(
  db: Db,
  clientId: string,
  email?: string | null,
  phone?: string | null
) {
  const bookings = await db.booking.findMany({
    where: {
      clientId,
      isTrial: true,
      status: { not: 'CANCELLED' },
    },
    select: { customerEmail: true, customerPhone: true },
  });
  return bookings.some((b) => sameCustomer(b, email, phone));
}

export async function findPromo(db: Db, clientId: string, code?: string | null) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  return db.classPromo.findFirst({
    where: { clientId, isActive: true, code: { equals: normalized, mode: 'insensitive' } },
  });
}

export function classEndTime(startTime: string, duration: number) {
  return minutesToTime(timeToMinutes(startTime) + duration);
}

export async function listClassesForDay(clientId: string, dateStr: string) {
  const { start, end, dayOfWeek } = parseDateOnly(dateStr);
  const services = await prisma.service.findMany({
    where: {
      clientId,
      isActive: true,
      NOT: { kind: 'access' },
      OR: [{ kind: 'class' }, { useCustomHours: true }],
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
      workingHours: true,
    },
    orderBy: { name: 'asc' },
  });

  const bookings = await prisma.booking.findMany({
    where: {
      clientId,
      date: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
      service: { kind: 'class' },
    },
    select: { serviceId: true, startTime: true },
  });

  const classes = [];
  for (const service of services) {
    if (/clase de prueba|clase suelta/i.test(service.name)) continue;
    const hours = await resolveHoursForDay(prisma, {
      clientId,
      serviceId: service.id,
      useCustomHours: service.useCustomHours,
      dayOfWeek,
    });
    if (!hours || !hours.isOpen) continue;

    const startTime = hours.openTime;
    const taken = bookings.filter((b) => b.serviceId === service.id && b.startTime === startTime).length;
    const capacity = service.capacity > 1 ? service.capacity : DEFAULT_CLASS_CAPACITY;
    const remaining = Math.max(0, capacity - taken);
    const { dateStr: today, minutes: nowMinutes } = zonedNow();
    const past = dateStr < today || (dateStr === today && timeToMinutes(startTime) <= nowMinutes);

    classes.push({
      serviceId: service.id,
      name: service.name,
      description: service.description,
      duration: service.duration,
      price: service.price ?? DEFAULT_DROP_IN_PRICE,
      color: service.color,
      category: service.category,
      startTime,
      endTime: classEndTime(startTime, service.duration),
      capacity,
      taken,
      remaining,
      full: remaining <= 0,
      past,
    });
  }

  return classes.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export async function loadStudioService(clientId: string, serviceId: string) {
  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      clientId,
      isActive: true,
      NOT: { kind: 'access' },
    },
  });
  if (!service || /clase de prueba|clase suelta/i.test(service.name)) return null;
  return {
    ...service,
    capacity: service.capacity > 1 ? service.capacity : DEFAULT_CLASS_CAPACITY,
    price: service.price ?? DEFAULT_DROP_IN_PRICE,
  };
}

export async function promoteWaitlist(params: {
  clientId: string;
  serviceId: string;
  dateStr: string;
  startTime: string;
  capacity: number;
  duration: number;
}) {
  const room = await classHasRoom(prisma, params);
  if (room.full) return null;

  const { start, end } = parseDateOnly(params.dateStr);
  const next = await prisma.classWaitlist.findFirst({
    where: {
      clientId: params.clientId,
      serviceId: params.serviceId,
      date: { gte: start, lte: end },
      startTime: params.startTime,
      status: 'WAITING',
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!next) return null;

  const purchase = await pickPurchaseWithCredit(prisma, params.clientId, next.customerEmail, next.customerPhone);
  if (!purchase) return null;

  const booking = await prisma.$transaction(async (tx) => {
    const stillRoom = await classHasRoom(tx, params);
    if (stillRoom.full) return null;
    const latest = await tx.membershipPurchase.findUnique({ where: { id: purchase.id } });
    if (!latest || latest.creditsUsed >= latest.creditsTotal) return null;

    const created = await tx.booking.create({
      data: {
        clientId: params.clientId,
        serviceId: params.serviceId,
        customerName: next.customerName,
        customerEmail: next.customerEmail,
        customerPhone: next.customerPhone,
        date: bookingStorageDate(params.dateStr),
        startTime: params.startTime,
        endTime: classEndTime(params.startTime, params.duration),
        status: 'CONFIRMED',
        paymentStatus: 'CREDITED',
        paymentMethod: 'CREDIT',
        membershipPurchaseId: latest.id,
      },
    });
    await tx.membershipPurchase.update({
      where: { id: latest.id },
      data: { creditsUsed: { increment: 1 } },
    });
    await tx.classWaitlist.update({
      where: { id: next.id },
      data: { status: 'PROMOTED' },
    });
    return created;
  });

  return booking ? { booking, waitlist: next } : null;
}
