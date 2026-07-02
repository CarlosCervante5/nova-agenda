import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const PLAN_LIMITS = {
  FREE: {
    maxServices: 3,
    maxBookingsPerMonth: 50,
    publicBooking: true,
  },
  BASIC: {
    maxServices: 20,
    maxBookingsPerMonth: null as number | null,
    publicBooking: true,
  },
  PRO: {
    maxServices: null as number | null,
    maxBookingsPerMonth: null as number | null,
    publicBooking: true,
  },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as PlanKey] ?? PLAN_LIMITS.FREE;
}

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getClientPlanUsage(clientId: string, plan: string) {
  const limits = getPlanLimits(plan);
  const monthStart = startOfCurrentMonth();

  const [servicesUsed, bookingsThisMonth] = await Promise.all([
    prisma.service.count({ where: { clientId } }),
    prisma.booking.count({
      where: {
        clientId,
        createdAt: { gte: monthStart },
        status: { not: 'CANCELLED' },
      },
    }),
  ]);

  return {
    services: { used: servicesUsed, limit: limits.maxServices },
    bookingsThisMonth: { used: bookingsThisMonth, limit: limits.maxBookingsPerMonth },
    publicBooking: limits.publicBooking,
  };
}

export type PlanLimitError = {
  ok: false;
  status: number;
  error: string;
  code: 'PLAN_UPGRADE_REQUIRED' | 'SERVICE_LIMIT' | 'BOOKING_LIMIT';
  currentPlan: string;
  requiredPlan?: string;
  limit?: number;
  used?: number;
};

export async function assertCanCreateService(
  clientId: string,
  plan: string
): Promise<PlanLimitError | { ok: true }> {
  const limits = getPlanLimits(plan);

  if (limits.maxServices === null) {
    return { ok: true };
  }

  const used = await prisma.service.count({ where: { clientId } });

  if (used >= limits.maxServices) {
    const requiredPlan = plan === 'FREE' ? 'BASIC' : 'PRO';
    return {
      ok: false,
      status: 403,
      code: 'SERVICE_LIMIT',
      error:
        plan === 'FREE'
          ? `Has alcanzado el límite de ${limits.maxServices} servicios del plan Gratuito. Actualiza a Profesional para agregar más.`
          : `Has alcanzado el límite de ${limits.maxServices} servicios del plan Profesional. Actualiza a Business para servicios ilimitados.`,
      currentPlan: plan,
      requiredPlan,
      limit: limits.maxServices,
      used,
    };
  }

  return { ok: true };
}

export async function assertCanCreateBooking(
  clientId: string,
  plan: string,
  options: { viaPublicPortal?: boolean } = {}
): Promise<PlanLimitError | { ok: true }> {
  const limits = getPlanLimits(plan);

  if (options.viaPublicPortal && !limits.publicBooking) {
    return {
      ok: false,
      status: 403,
      code: 'PLAN_UPGRADE_REQUIRED',
      error: 'El portal de reservas no está disponible en tu plan actual.',
      currentPlan: plan,
      requiredPlan: 'BASIC',
    };
  }

  if (limits.maxBookingsPerMonth === null) {
    return { ok: true };
  }

  const monthStart = startOfCurrentMonth();
  const used = await prisma.booking.count({
    where: {
      clientId,
      createdAt: { gte: monthStart },
      status: { not: 'CANCELLED' },
    },
  });

  if (used >= limits.maxBookingsPerMonth) {
    return {
      ok: false,
      status: 403,
      code: 'BOOKING_LIMIT',
      error: `Has alcanzado el límite de ${limits.maxBookingsPerMonth} citas este mes en el plan Gratuito. Actualiza a Profesional para citas ilimitadas.`,
      currentPlan: plan,
      requiredPlan: 'BASIC',
      limit: limits.maxBookingsPerMonth,
      used,
    };
  }

  return { ok: true };
}

export function sendPlanLimitError(res: import('express').Response, result: PlanLimitError) {
  return res.status(result.status).json({
    error: result.error,
    code: result.code,
    currentPlan: result.currentPlan,
    requiredPlan: result.requiredPlan,
    limit: result.limit,
    used: result.used,
  });
}
