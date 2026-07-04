import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { awardLoyaltyStampForBooking } from '../services/loyalty';
import { assertCanCreateBooking, sendPlanLimitError } from '../middleware/plan-limits';
import {
  parseDateOnly,
  bookingStorageDate,
  timeToMinutes,
  minutesToTime,
  normalizeSlotGap,
  slotConflictsWithBooking,
} from '../utils/date-only';

const router = Router();
const prisma = new PrismaClient();

async function hasScheduleConflict(params: {
  clientId: string;
  dayStart: Date;
  dayEnd: Date;
  startTime: string;
  endTime: string;
  gapMinutes: number;
  staffId?: string | null;
}) {
  const where: {
    clientId: string;
    date: { gte: Date; lte: Date };
    status: { not: string };
    staffId?: string;
  } = {
    clientId: params.clientId,
    date: { gte: params.dayStart, lte: params.dayEnd },
    status: { not: 'CANCELLED' },
  };
  if (params.staffId) where.staffId = params.staffId;

  const bookings = await prisma.booking.findMany({
    where,
    select: { startTime: true, endTime: true },
  });

  const slotStart = timeToMinutes(params.startTime);
  const slotEnd = timeToMinutes(params.endTime);

  return bookings.some((b) =>
    slotConflictsWithBooking(slotStart, slotEnd, b.startTime, b.endTime, params.gapMinutes)
  );
}

// Get bookings
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.clientId;
    const { date, dateFrom, dateTo, status, serviceId } = req.query;

    if (!clientId && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'No client associated with this user' });
    }

    const targetClientId = req.user!.role === 'SUPER_ADMIN'
      ? (req.query.clientId as string || clientId)
      : clientId;

    const where: any = {};
    if (targetClientId) where.clientId = targetClientId;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = parseDateOnly(dateFrom as string).start;
      }
      if (dateTo) {
        where.date.lte = parseDateOnly(dateTo as string).end;
      }
    } else if (date) {
      const { start, end } = parseDateOnly(date as string);
      where.date = { gte: start, lte: end };
    }

    if (status) where.status = status;
    if (serviceId) where.serviceId = serviceId;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: { select: { name: true, color: true, duration: true } },
        staff: { select: { id: true, name: true, color: true, title: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create booking (authenticated — panel admin)
router.post('/admin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user!.clientId;
    if (!clientId && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'No client associated with this user' });
    }

    const targetClientId = req.user!.role === 'SUPER_ADMIN'
      ? (req.body.clientId || clientId)
      : clientId;

    const { serviceId, staffId, customerName, customerEmail, customerPhone, date, startTime, notes } = req.body;

    if (!targetClientId || !serviceId || !customerName || !date || !startTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await prisma.client.findUnique({ where: { id: targetClientId } });
    if (!client || !client.isActive) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const bookingLimit = await assertCanCreateBooking(client.id, client.plan);
    if (!bookingLimit.ok) {
      return sendPlanLimitError(res, bookingLimit);
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || service.clientId !== client.id) {
      return res.status(404).json({ error: 'Service not found' });
    }

    let resolvedStaffId: string | null = staffId || null;
    if (resolvedStaffId) {
      const staff = await prisma.staffMember.findFirst({
        where: { id: resolvedStaffId, clientId: client.id, isActive: true },
      });
      if (!staff) {
        return res.status(404).json({ error: 'Personal no encontrado' });
      }
    }

    const startMin = timeToMinutes(startTime);
    const endTime = minutesToTime(startMin + service.duration);

    const bookingDate = bookingStorageDate(date);
    const { start, end } = parseDateOnly(date);
    const gapMinutes = normalizeSlotGap(client.slotGapMinutes);

    const conflict = await hasScheduleConflict({
      clientId: client.id,
      dayStart: start,
      dayEnd: end,
      startTime,
      endTime,
      gapMinutes,
      staffId: resolvedStaffId,
    });

    if (conflict) {
      return res.status(409).json({
        error: `Ese horario no está disponible (incluye ${gapMinutes} min de espacio entre citas)`,
      });
    }

    const booking = await prisma.booking.create({
      data: {
        clientId: client.id,
        serviceId,
        staffId: resolvedStaffId,
        customerName,
        customerEmail,
        customerPhone,
        date: bookingDate,
        startTime,
        endTime,
        notes,
        status: 'PENDING',
      },
      include: {
        service: { select: { name: true, color: true } },
        staff: { select: { id: true, name: true, color: true, title: true } },
      },
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error('Create admin booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create booking (public - for client portals)
router.post('/', async (req, res: Response) => {
  try {
    const { clientSlug, serviceId, staffId, customerName, customerEmail, customerPhone, date, startTime, notes } = req.body;

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

    const bookingLimit = await assertCanCreateBooking(client.id, client.plan, { viaPublicPortal: true });
    if (!bookingLimit.ok) {
      return sendPlanLimitError(res, bookingLimit);
    }

    let resolvedStaffId: string | null = null;
    if (staffId) {
      const staff = await prisma.staffMember.findFirst({
        where: {
          id: staffId,
          clientId: client.id,
          isActive: true,
          OR: [
            { services: { none: {} } },
            { services: { some: { serviceId } } },
          ],
        },
      });
      if (!staff) {
        return res.status(404).json({ error: 'Personal no disponible para este servicio' });
      }
      resolvedStaffId = staff.id;
    }

    const startMin = timeToMinutes(startTime);
    const endTime = minutesToTime(startMin + service.duration);

    // Check for conflicts (por personal si se eligió + espacio entre citas)
    const bookingDate = bookingStorageDate(date);
    const { start, end } = parseDateOnly(date);
    const gapMinutes = normalizeSlotGap(client.slotGapMinutes);

    const conflict = await hasScheduleConflict({
      clientId: client.id,
      dayStart: start,
      dayEnd: end,
      startTime,
      endTime,
      gapMinutes,
      staffId: resolvedStaffId,
    });

    if (conflict) {
      return res.status(409).json({
        error: `Ese horario no está disponible (incluye ${gapMinutes} min de espacio entre citas)`,
      });
    }

    const booking = await prisma.booking.create({
      data: {
        clientId: client.id,
        serviceId,
        staffId: resolvedStaffId,
        customerName,
        customerEmail,
        customerPhone,
        date: bookingDate,
        startTime,
        endTime,
        notes,
        status: 'PENDING',
      },
      include: {
        service: { select: { name: true } },
        staff: { select: { id: true, name: true } },
      },
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

    if (status === 'COMPLETED') {
      awardLoyaltyStampForBooking(id).catch(err =>
        console.error('[Loyalty] Error awarding stamp for booking:', err)
      );
    }

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
