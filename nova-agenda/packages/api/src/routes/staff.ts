import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getPlanLevel } from '../middleware/plan-check';

const router = Router();
const prisma = new PrismaClient();

const staffInclude = {
  services: {
    include: {
      service: { select: { id: true, name: true, duration: true, color: true, isActive: true } },
    },
  },
  _count: { select: { bookings: true } },
};

function canAccessClient(req: AuthRequest, clientId: string) {
  return req.user!.role === 'SUPER_ADMIN' || req.user!.clientId === clientId;
}

async function assertStaffPlan(clientId: string, res: Response) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { plan: true },
  });
  if (!client) {
    res.status(404).json({ error: 'Negocio no encontrado' });
    return null;
  }
  if (getPlanLevel(client.plan) < getPlanLevel('BASIC')) {
    res.status(403).json({
      error: 'El módulo de personal requiere el plan Profesional o superior.',
      code: 'PLAN_UPGRADE_REQUIRED',
      currentPlan: client.plan,
      requiredPlan: 'BASIC',
    });
    return null;
  }
  return client;
}

// List staff
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId =
      req.user!.role === 'SUPER_ADMIN'
        ? (req.query.clientId as string) || req.user!.clientId
        : req.user!.clientId;

    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado' });
    }
    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertStaffPlan(clientId, res))) return;

    const staff = await prisma.staffMember.findMany({
      where: { clientId },
      include: staffInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    res.json(staff);
  } catch (error) {
    console.error('List staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create staff
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId =
      req.user!.role === 'SUPER_ADMIN'
        ? req.body.clientId || req.user!.clientId
        : req.user!.clientId;

    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado' });
    }
    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertStaffPlan(clientId, res))) return;

    const { name, email, phone, title, bio, color, avatarUrl, isActive, serviceIds, sortOrder } =
      req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const serviceIdList: string[] = Array.isArray(serviceIds)
      ? serviceIds.filter(Boolean)
      : [];

    if (serviceIdList.length > 0) {
      const validServices = await prisma.service.count({
        where: { clientId, id: { in: serviceIdList } },
      });
      if (validServices !== serviceIdList.length) {
        return res.status(400).json({ error: 'Uno o más servicios no pertenecen a este negocio' });
      }
    }

    const staff = await prisma.staffMember.create({
      data: {
        clientId,
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        title: title || null,
        bio: bio || null,
        color: color || '#2dd4bf',
        avatarUrl: avatarUrl || null,
        isActive: isActive !== false,
        sortOrder: Number(sortOrder) || 0,
        services: {
          create: serviceIdList.map((serviceId) => ({ serviceId })),
        },
      },
      include: staffInclude,
    });

    res.status(201).json(staff);
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update staff
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.staffMember.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Personal no encontrado' });
    }
    if (!canAccessClient(req, existing.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertStaffPlan(existing.clientId, res))) return;

    const { name, email, phone, title, bio, color, avatarUrl, isActive, serviceIds, sortOrder } =
      req.body;

    if (Array.isArray(serviceIds)) {
      const serviceIdList = serviceIds.filter(Boolean) as string[];
      if (serviceIdList.length > 0) {
        const validServices = await prisma.service.count({
          where: { clientId: existing.clientId, id: { in: serviceIdList } },
        });
        if (validServices !== serviceIdList.length) {
          return res.status(400).json({ error: 'Uno o más servicios no pertenecen a este negocio' });
        }
      }
      await prisma.staffService.deleteMany({ where: { staffId: id } });
      if (serviceIdList.length > 0) {
        await prisma.staffService.createMany({
          data: serviceIdList.map((serviceId) => ({ staffId: id, serviceId })),
        });
      }
    }

    const staff = await prisma.staffMember.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(email !== undefined && { email: email || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(title !== undefined && { title: title || null }),
        ...(bio !== undefined && { bio: bio || null }),
        ...(color !== undefined && { color }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
      },
      include: staffInclude,
    });

    res.json(staff);
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle active
router.patch('/:id/toggle', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.staffMember.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Personal no encontrado' });
    }
    if (!canAccessClient(req, existing.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertStaffPlan(existing.clientId, res))) return;

    const staff = await prisma.staffMember.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: staffInclude,
    });

    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete staff
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.staffMember.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Personal no encontrado' });
    }
    if (!canAccessClient(req, existing.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertStaffPlan(existing.clientId, res))) return;

    await prisma.staffMember.delete({ where: { id } });
    res.json({ message: 'Personal eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
