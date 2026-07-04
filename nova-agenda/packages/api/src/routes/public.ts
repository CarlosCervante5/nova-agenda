import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { resolveTenant, TenantRequest } from '../middleware/auth';
import {
  parseDateOnly,
  minutesToTime,
  timeToMinutes,
  normalizeSlotGap,
  slotConflictsWithBooking,
} from '../utils/date-only';

const router = Router();
const prisma = new PrismaClient();

const clientSelect = {
  id: true,
  name: true,
  slug: true,
  primaryColor: true,
  isActive: true,
  slotGapMinutes: true,
} as const;

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

    const dbHours = await prisma.workingHours.findUnique({
      where: { clientId_dayOfWeek: { clientId: client.id, dayOfWeek } },
    });

    const workingHours = dbHours ?? DEFAULT_WORKING_HOURS.find((wh) => wh.dayOfWeek === dayOfWeek) ?? null;

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

    const openMinutes = timeToMinutes(workingHours.openTime);
    const closeMinutes = timeToMinutes(workingHours.closeTime);
    const duration = service.duration;
    const gapMinutes = normalizeSlotGap(client.slotGapMinutes);

    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const slots: string[] = [];
    let current = openMinutes;
    const step = 5;

    while (current + duration <= closeMinutes) {
      const slotStart = minutesToTime(current);
      const slotEndMin = current + duration;

      const isPast = isToday && current <= nowMinutes;
      const isAvailable =
        !isPast &&
        !existingBookings.some((booking) =>
          slotConflictsWithBooking(
            current,
            slotEndMin,
            booking.startTime,
            booking.endTime,
            gapMinutes
          )
        );

      if (isAvailable) {
        slots.push(slotStart);
      }

      current += step;
    }

    res.json({
      slots,
      service: { name: service.name, duration: service.duration },
      slotGapMinutes: gapMinutes,
    });
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
        domain: true,
        email: true,
        phone: true,
        address: true,
        logo: true,
        primaryColor: true,
        tagline: true,
        about: true,
        coverImage: true,
        instagram: true,
        facebook: true,
        whatsappPhone: true,
        websiteEnabled: true,
        slotGapMinutes: true,
        bookingFormEnabled: true,
        bookingRequirePhone: true,
        bookingRequireEmail: true,
        bookingShowNotes: true,
        bookingIntroText: true,
        bookingSuccessText: true,
        bookingConfirmAuto: true,
        plan: true,
        services: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            duration: true,
            price: true,
            color: true,
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
                parentId: true,
                parent: { select: { id: true, name: true, color: true } },
              },
            },
          },
        },
        serviceCategories: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            parentId: true,
            children: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              select: { id: true, name: true, description: true, color: true, parentId: true },
            },
          },
        },
        workingHours: {
          orderBy: { dayOfWeek: 'asc' },
          select: { dayOfWeek: true, openTime: true, closeTime: true, isOpen: true },
        },
        staffMembers: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            title: true,
            bio: true,
            color: true,
            avatarUrl: true,
            services: { select: { serviceId: true } },
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (client.plan !== 'FREE' && client.websiteEnabled === false) {
      return res.status(404).json({
        error: 'Website disabled',
        bookingDisabled: true,
        message: 'Esta página web está temporalmente desactivada.',
        plan: client.plan,
      });
    }

    if (client.bookingFormEnabled === false) {
      const { staffMembers: _s, serviceCategories: _c, ...rest } = client;
      return res.json({
        ...rest,
        services: [],
        staff: [],
        categories: [],
        bookingDisabled: true,
        message: 'Las reservas en línea están temporalmente desactivadas.',
      });
    }

    const staff =
      client.plan === 'FREE'
        ? []
        : client.staffMembers.map((s) => ({
            id: s.id,
            name: s.name,
            title: s.title,
            bio: s.bio,
            color: s.color,
            avatarUrl: s.avatarUrl,
            serviceIds: s.services.map((ss) => ss.serviceId),
          }));

    const categories =
      client.plan === 'FREE'
        ? []
        : client.serviceCategories.filter((c) => !c.parentId);

    const { staffMembers: _staffMembers, serviceCategories: _cats, ...rest } = client;
    res.json({ ...rest, staff, categories });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
