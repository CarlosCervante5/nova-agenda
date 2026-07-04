import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { assertCanCreateService, sendPlanLimitError } from '../middleware/plan-limits';
import { getPlanLevel } from '../middleware/plan-check';

const router = Router();
const prisma = new PrismaClient();

async function resolveCategoryId(
  clientId: string,
  plan: string,
  categoryId: string | null | undefined
): Promise<string | null | undefined> {
  if (categoryId === undefined) return undefined;
  if (!categoryId) return null;
  if (getPlanLevel(plan) < getPlanLevel('BASIC')) return null;

  const category = await prisma.serviceCategory.findFirst({
    where: { id: categoryId, clientId },
  });
  return category ? category.id : null;
}

// Get services for a client
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.clientId;

    if (!clientId && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'No client associated with this user' });
    }

    // Super admin can query by clientId param
    const targetClientId = req.user!.role === 'SUPER_ADMIN'
      ? (req.query.clientId as string || clientId)
      : clientId;

    const services = await prisma.service.findMany({
      where: { clientId: targetClientId },
      include: {
        _count: { select: { bookings: true } },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create service
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.clientId;

    if (!clientId && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'No client associated with this user' });
    }

    const targetClientId = req.user!.role === 'SUPER_ADMIN'
      ? (req.body.clientId || clientId)
      : clientId;

    const { name, description, duration, price, color, categoryId } = req.body;

    if (!name || !duration) {
      return res.status(400).json({ error: 'Name and duration are required' });
    }

    const owner = await prisma.client.findUnique({
      where: { id: targetClientId },
      select: { plan: true },
    });

    if (!owner) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const serviceLimit = await assertCanCreateService(targetClientId!, owner.plan);
    if (!serviceLimit.ok) {
      return sendPlanLimitError(res, serviceLimit);
    }

    const resolvedCategoryId = await resolveCategoryId(targetClientId!, owner.plan, categoryId);
    if (categoryId && resolvedCategoryId === null) {
      return res.status(400).json({ error: 'Categoría no válida o no disponible en tu plan' });
    }

    const service = await prisma.service.create({
      data: {
        name,
        description,
        duration: parseInt(duration),
        price: price ? parseFloat(price) : null,
        color: color || '#2dd4bf',
        clientId: targetClientId,
        categoryId: resolvedCategoryId ?? null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update service
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, duration, price, color, isActive, categoryId } = req.body;

    const service = await prisma.service.findUnique({ where: { id } });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check ownership
    if (req.user!.role !== 'SUPER_ADMIN' && service.clientId !== req.user!.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const owner = await prisma.client.findUnique({
      where: { id: service.clientId },
      select: { plan: true },
    });

    let resolvedCategoryId: string | null | undefined = undefined;
    if (categoryId !== undefined) {
      resolvedCategoryId = await resolveCategoryId(service.clientId, owner?.plan || 'FREE', categoryId);
      if (categoryId && resolvedCategoryId === null) {
        return res.status(400).json({ error: 'Categoría no válida o no disponible en tu plan' });
      }
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(duration && { duration: parseInt(duration) }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null }),
        ...(color && { color }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(resolvedCategoryId !== undefined && { categoryId: resolvedCategoryId }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete service
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const service = await prisma.service.findUnique({ where: { id } });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (req.user!.role !== 'SUPER_ADMIN' && service.clientId !== req.user!.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.service.delete({ where: { id } });
    res.json({ message: 'Service deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
