import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get bookings
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.clientId;
    const { date, status, serviceId } = req.query;

    if (!clientId && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'No client associated with this user' });
    }

    const targetClientId = req.user!.role === 'SUPER_ADMIN'
      ? (req.query.clientId as string || clientId)
      : clientId;

    const where: any = { clientId: targetClientId };

    if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }

    if (status) where.status = status;
    if (serviceId) where.serviceId = serviceId;

    const bookings = await prisma.booking.findMany({
      where,
      include: { service: { select: { name: true, color: true, duration: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create booking (public - for client portals)
router.post('/', async (req, res: Response) => {
  try {
    const { clientSlug, serviceId, customerName, customerEmail, customerPhone, date, startTime, notes } = req.body;

    if (!clientSlug || !serviceId || !customerName || !date || !startTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await prisma.client.findUnique({ where: { slug: clientSlug } });
    if (!client || !client.isActive) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.isActive || service.clientId !== client.id) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Calculate end time
    const [hours, minutes] = startTime.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + service.duration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    // Check for conflicts
    const bookingDate = new Date(date);
    const conflict = await prisma.booking.findFirst({
      where: {
        clientId: client.id,
        date: bookingDate,
        status: { not: 'CANCELLED' },
        OR: [
          { startTime: { lt: endTime }, endTime: { gt: startTime } },
        ],
      },
    });

    if (conflict) {
      return res.status(409).json({ error: 'Time slot is already booked' });
    }

    const booking = await prisma.booking.create({
      data: {
        clientId: client.id,
        serviceId,
        customerName,
        customerEmail,
        customerPhone,
        date: bookingDate,
        startTime,
        endTime,
        notes,
        status: 'PENDING',
      },
      include: { service: { select: { name: true } } },
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update booking status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (req.user!.role !== 'SUPER_ADMIN' && booking.clientId !== req.user!.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status },
      include: { service: { select: { name: true, color: true } } },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete booking
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (req.user!.role !== 'SUPER_ADMIN' && booking.clientId !== req.user!.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.booking.delete({ where: { id } });
    res.json({ message: 'Booking deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
