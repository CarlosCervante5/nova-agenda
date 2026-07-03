import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { resolveTenant, TenantRequest } from '../middleware/auth';
import { parseDateOnly, bookingStorageDate } from '../utils/date-only';

const router = Router();
const prisma = new PrismaClient();

const clientSelect = { id: true, name: true, slug: true, primaryColor: true, isActive: true } as const;

async function resolvePublicClient(req: TenantRequest) {
  const slug = (req.query.clientSlug || req.query.tenant) as string | undefined;
  if (slug) {
    return prisma.client.findUnique({ where: { slug, isActive: true }, select: clientSelect });
  }
  if (req.client) {
    return prisma.client.findUnique({ where: { id: req.client.id, isActive: true }, select: clientSelect });
  }
  return null;
}

const DEFAULT_WORKING_HOURS = [
  { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 2, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 3, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 4, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 5, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 6, openTime: '10:00', closeTime: '14:00', isOpen: true },
  { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isOpen: false },
];

// Register new business
router.post('/register', async (req, res: Response) => {
  try {
    const { businessName, ownerName, email, password, plan } = req.body;

    if (!businessName || !ownerName || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Este correo ya está registrado' });
    }

    const slug = businessName
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let finalSlug = slug;
    let counter = 1;
    while (await prisma.client.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    const validPlan = ['FREE', 'BASIC', 'PRO'].includes(plan) ? plan : 'FREE';
    const hashedPassword = await bcrypt.hash(password, 10);

    const client = await prisma.client.create({
      data: {
        name: businessName,
        slug: finalSlug,
        email,
        plan: validPlan,
        users: {
          create: {
            email,
            password: hashedPassword,
            name: ownerName,
            role: 'ADMIN',
          },
        },
        workingHours: {
          create: [
            { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00', isOpen: true },
            { dayOfWeek: 2, openTime: '09:00', closeTime: '18:00', isOpen: true },
            { dayOfWeek: 3, openTime: '09:00', closeTime: '18:00', isOpen: true },
            { dayOfWeek: 4, openTime: '09:00', closeTime: '18:00', isOpen: true },
            { dayOfWeek: 5, openTime: '09:00', closeTime: '18:00', isOpen: true },
            { dayOfWeek: 6, openTime: '10:00', closeTime: '14:00', isOpen: true },
            { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isOpen: false },
          ],
        },
      },
      include: { users: { select: { id: true, email: true, name: true, role: true } } },
    });

    const user = client.users[0];

    const jwt = await import('jsonwebtoken');
    const { config } = await import('../config');
    const token = jwt.default.sign(
      { id: user.id, email: user.email, role: user.role, clientId: client.id },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, clientId: client.id },
      client: { id: client.id, name: client.name, slug: client.slug, plan: client.plan },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get available slots for a service on a specific date
router.get('/slots', resolveTenant, async (req: TenantRequest, res: Response) => {
  try {
    const client = await resolvePublicClient(req);
    const { serviceId, date } = req.query;

    if (!client) {
      return res.status(400).json({ error: 'Client not found' });
    }

    if (!serviceId || !date) {
      return res.status(400).json({ error: 'serviceId and date are required' });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId as string },
    });

    if (!service || service.clientId !== client.id || !service.isActive) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const { start, end, dayOfWeek } = parseDateOnly(date as string);

    let workingHours = await prisma.workingHours.findUnique({
      where: { clientId_dayOfWeek: { clientId: client.id, dayOfWeek } },
    });

    if (!workingHours) {
      workingHours = DEFAULT_WORKING_HOURS.find((wh) => wh.dayOfWeek === dayOfWeek) ?? null;
    }

    if (!workingHours || !workingHours.isOpen) {
      return res.json({ slots: [], message: 'Closed on this day' });
    }

    const existingBookings = await prisma.booking.findMany({
      where: {
        clientId: client.id,
        date: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      select: { startTime: true, endTime: true },
    });

    const [openHour, openMin] = workingHours.openTime.split(':').map(Number);
    const [closeHour, closeMin] = workingHours.closeTime.split(':').map(Number);
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    const duration = service.duration;

    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

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

      const isPast = isToday && current <= nowMinutes;
      const isAvailable = !isPast && !existingBookings.some(
        (booking) => booking.startTime < slotEnd && booking.endTime > slotStart
      );

      if (isAvailable) {
        slots.push(slotStart);
      }

      current += 30;
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

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
