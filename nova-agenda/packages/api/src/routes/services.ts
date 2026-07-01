import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

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
      include: { _count: { select: { bookings: true } } },
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

    const { name, description, duration, price, color } = req.body;

    if (!name || !duration) {
      return res.status(400).json({ error: 'Name and duration are required' });
    }

    const service = await prisma.service.create({
      data: {
        name,
        description,
        duration: parseInt(duration),
        price: price ? parseFloat(price) : null,
        color: color || '#2563eb',
        clientId: targetClientId,
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
    const { name, description, duration, price, color, isActive } = req.body;

    const service = await prisma.service.findUnique({ where: { id } });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check ownership
    if (req.user!.role !== 'SUPER_ADMIN' && service.clientId !== req.user!.clientId) {
      return res.status(403).json({ error: 'Access denied' });
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
