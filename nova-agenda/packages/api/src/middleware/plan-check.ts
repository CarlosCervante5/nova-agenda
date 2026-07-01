import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';

const prisma = new PrismaClient();

// Plan hierarchy: FREE < BASIC < PRO
const PLAN_HIERARCHY: Record<string, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
};

/**
 * Middleware factory: checks if the authenticated user's client has at least the required plan.
 * Usage: router.get('/path', authenticate, checkPlan('BASIC'), handler)
 */
export function checkPlan(requiredPlan: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const clientId = req.user?.clientId;
      if (!clientId) {
        return res.status(403).json({ error: 'No client associated with this user' });
      }

      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { plan: true },
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const clientLevel = PLAN_HIERARCHY[client.plan] ?? 0;
      const requiredLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;

      if (clientLevel < requiredLevel) {
        return res.status(403).json({
          error: `This feature requires the ${requiredPlan} plan or higher`,
          currentPlan: client.plan,
          requiredPlan,
        });
      }

      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

/**
 * Helper: check if a plan level is sufficient (for frontend logic).
 */
export function isPlanSufficient(currentPlan: string, requiredPlan: string): boolean {
  const clientLevel = PLAN_HIERARCHY[currentPlan] ?? 0;
  const requiredLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;
  return clientLevel >= requiredLevel;
}

/**
 * Get the plan level as a number (for comparison).
 */
export function getPlanLevel(plan: string): number {
  return PLAN_HIERARCHY[plan] ?? 0;
}
