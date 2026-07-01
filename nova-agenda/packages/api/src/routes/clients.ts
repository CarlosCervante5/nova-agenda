import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all clients (super admin only)
router.get('/', authenticate, authorize('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        _count: { select: { users: true, services: true, bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single client
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // CLIENT users can only see their own client
    if (req.user!.role === 'CLIENT' && req.user!.clientId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        services: { where: { isActive: true } },
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
        _count: { select: { users: true, bookings: true } },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create client (super admin only)
router.post('/', authenticate, authorize('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, email, phone, address, primaryColor, plan } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    const existing = await prisma.client.findFirst({
      where: { OR: [{ slug }, ...(email ? [{ email }] : [])] },
    });

    if (existing) {
      return res.status(409).json({ error: 'Client with this slug or email already exists' });
    }

    const client = await prisma.client.create({
      data: {
        name,
        slug,
        email,
        phone,
        address,
        primaryColor: primaryColor || '#2563eb',
        plan: plan || 'FREE',
      },
    });

    // Create default working hours
    for (let day = 0; day < 7; day++) {
      await prisma.workingHours.create({
        data: {
          clientId: client.id,
          dayOfWeek: day,
          openTime: '09:00',
          closeTime: day === 6 ? '14:00' : '18:00',
          isOpen: day >= 1 && day <= 6,
        },
      });
    }

    res.status(201).json(client);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update client
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.role === 'CLIENT' && req.user!.clientId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, email, phone, address, primaryColor, plan, isActive } = req.body;

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(primaryColor && { primaryColor }),
        ...(plan && { plan }),
        ...(typeof isActive === 'boolean' && req.user!.role !== 'CLIENT' && { isActive }),
      },
    });

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete client (super admin only)
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.client.delete({ where: { id } });
    res.json({ message: 'Client deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
