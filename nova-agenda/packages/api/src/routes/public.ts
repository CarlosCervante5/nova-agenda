import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { resolveTenant, TenantRequest } from '../middleware/auth';
import { getPlanLevel } from '../middleware/plan-check';

const router = Router();
const prisma = new PrismaClient();

// Get available slots for a service on a specific date
router.get('/slots', resolveTenant, async (req: TenantRequest, res: Response) => {
  try {
    const client = req.client;
    const { serviceId, date } = req.query;

    if (!client) {
      return res.status(400).json({ error: 'Client not found' });
    }

    // Plan check: FREE plan cannot use booking page
    const fullClient = await prisma.client.findUnique({
      where: { id: client.id },
      select: { plan: true },
    });

    if (getPlanLevel(fullClient?.plan || 'FREE') < getPlanLevel('BASIC')) {
      return res.status(403).json({
        error: 'Este negocio no tiene acceso al sistema de reservas',
        requiredPlan: 'BASIC',
      });
    }

    if (!serviceId || !date) {
      return res.status(400).json({ error: 'serviceId and date are required' });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId as string },
    });

    if (!service || service.clientId !== client.id) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Get working hours for the day
    const bookingDate = new Date(date as string);
    const dayOfWeek = bookingDate.getDay();

    const workingHours = await prisma.workingHours.findUnique({
      where: { clientId_dayOfWeek: { clientId: client.id, dayOfWeek } },
    });

    if (!workingHours || !workingHours.isOpen) {
      return res.json({ slots: [], message: 'Closed on this day' });
    }

    // Get existing bookings for the day
    const existingBookings = await prisma.booking.findMany({
      where: {
        clientId: client.id,
        date: bookingDate,
        status: { not: 'CANCELLED' },
      },
      select: { startTime: true, endTime: true },
    });

    // Generate available slots
    const [openHour, openMin] = workingHours.openTime.split(':').map(Number);
    const [closeHour, closeMin] = workingHours.closeTime.split(':').map(Number);
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    const duration = service.duration;

    const slots: string[] = [];
    let current = openMinutes;

    while (current + duration <= closeMinutes) {
      const hours = String(Math.floor(current / 60)).padStart(2, '0');
      const mins = String(current % 60).padStart(2, '0');
      const slotStart = `${hours}:${mins}`;

      const endMinutes = current + duration;
      const endHours = String(Math.floor(endMinutes / 60)).padStart(2, '0');
      const endMins = String(endMinutes % 60).padStart(2, '0');
      const slotEnd = `${endHours}:${endMins}`;

      // Check if slot conflicts with existing bookings
      const isAvailable = !existingBookings.some(
        (booking) => booking.startTime < slotEnd && booking.endTime > slotStart
      );

      if (isAvailable) {
        slots.push(slotStart);
      }

      current += 30; // 30-minute intervals
    }

    res.json({ slots, service: { name: service.name, duration: service.duration } });
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get public client info (for booking page)
router.get('/client/:slug', async (req, res: Response) => {
  try {
    const { slug } = req.params;

    const client = await prisma.client.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        primaryColor: true,
        plan: true,
        services: {
          where: { isActive: true },
          select: { id: true, name: true, description: true, duration: true, price: true, color: true },
        },
        workingHours: {
          orderBy: { dayOfWeek: 'asc' },
          select: { dayOfWeek: true, openTime: true, closeTime: true, isOpen: true },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // If FREE plan, return limited info (no booking capability)
    if (getPlanLevel(client.plan) < getPlanLevel('BASIC')) {
      return res.json({
        id: client.id,
        name: client.name,
        slug: client.slug,
        logo: client.logo,
        primaryColor: client.primaryColor,
        plan: client.plan,
        services: [],
        workingHours: [],
        bookingDisabled: true,
        message: 'Este negocio no tiene página de reservas. Actualiza a un plan Profesional.',
      });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
