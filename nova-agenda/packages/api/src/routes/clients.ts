import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

function canAccessClient(req: AuthRequest, clientId: string) {
  return req.user!.role === 'SUPER_ADMIN' || req.user!.clientId === clientId;
}

const DEFAULT_WORKING_HOURS = [
  { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 2, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 3, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 4, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 5, openTime: '09:00', closeTime: '18:00', isOpen: true },
  { dayOfWeek: 6, openTime: '10:00', closeTime: '14:00', isOpen: true },
  { dayOfWeek: 0, openTime: '09:00', closeTime: '18:00', isOpen: false },
];

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

    if (!canAccessClient(req, id)) {
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
        primaryColor: primaryColor || '#2dd4bf',
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

// Get working hours
router.get('/:id/working-hours', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!canAccessClient(req, id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    let hours = await prisma.workingHours.findMany({
      where: { clientId: id },
      orderBy: { dayOfWeek: 'asc' },
    });

    if (hours.length === 0) {
      await prisma.$transaction(
        DEFAULT_WORKING_HOURS.map((wh) =>
          prisma.workingHours.create({ data: { clientId: id, ...wh } })
        )
      );
      hours = await prisma.workingHours.findMany({
        where: { clientId: id },
        orderBy: { dayOfWeek: 'asc' },
      });
    }

    res.json(hours);
  } catch (error) {
    console.error('Get working hours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update working hours
router.put('/:id/working-hours', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!canAccessClient(req, id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { hours } = req.body as {
      hours: { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }[];
    };

    if (!Array.isArray(hours) || hours.length === 0) {
      return res.status(400).json({ error: 'hours array is required' });
    }

    const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    for (const entry of hours) {
      if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
        return res.status(400).json({ error: 'Invalid dayOfWeek' });
      }
      if (!/^\d{2}:\d{2}$/.test(entry.openTime) || !/^\d{2}:\d{2}$/.test(entry.closeTime)) {
        return res.status(400).json({ error: 'Invalid time format (use HH:mm)' });
      }
    }

    await prisma.$transaction(
      hours.map((entry) =>
        prisma.workingHours.upsert({
          where: { clientId_dayOfWeek: { clientId: id, dayOfWeek: entry.dayOfWeek } },
          create: { clientId: id, ...entry },
          update: {
            openTime: entry.openTime,
            closeTime: entry.closeTime,
            isOpen: entry.isOpen,
          },
        })
      )
    );

    const updated = await prisma.workingHours.findMany({
      where: { clientId: id },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update working hours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update client (incluye branding / página web)
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!canAccessClient(req, id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const {
      name,
      email,
      phone,
      address,
      primaryColor,
      logo,
      domain,
      slug,
      tagline,
      about,
      coverImage,
      instagram,
      facebook,
      whatsappPhone,
      websiteEnabled,
      slotGapMinutes,
      bookingFormEnabled,
      bookingRequirePhone,
      bookingRequireEmail,
      bookingShowNotes,
      bookingIntroText,
      bookingSuccessText,
      bookingConfirmAuto,
      plan,
      isActive,
    } = req.body;

    const websiteFields = [
      logo,
      domain,
      tagline,
      about,
      coverImage,
      instagram,
      facebook,
      whatsappPhone,
      websiteEnabled,
    ];
    const touchesWebsite = websiteFields.some((v) => v !== undefined);

    if (touchesWebsite && existing.plan === 'FREE' && req.user!.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'La página web personalizada requiere el plan Profesional o superior.',
        code: 'PLAN_UPGRADE_REQUIRED',
        requiredPlan: 'BASIC',
      });
    }

    if (slug && slug !== existing.slug) {
      const slugTaken = await prisma.client.findFirst({
        where: { slug, NOT: { id } },
      });
      if (slugTaken) {
        return res.status(409).json({ error: 'Ese slug ya está en uso' });
      }
    }

    if (domain && domain !== existing.domain) {
      const domainTaken = await prisma.client.findFirst({
        where: { domain, NOT: { id } },
      });
      if (domainTaken) {
        return res.status(409).json({ error: 'Ese dominio ya está en uso' });
      }
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(logo !== undefined && { logo }),
        ...(domain !== undefined && { domain: domain || null }),
        ...(slug !== undefined && { slug }),
        ...(tagline !== undefined && { tagline }),
        ...(about !== undefined && { about }),
        ...(coverImage !== undefined && { coverImage }),
        ...(instagram !== undefined && { instagram }),
        ...(facebook !== undefined && { facebook }),
        ...(whatsappPhone !== undefined && { whatsappPhone }),
        ...(typeof websiteEnabled === 'boolean' && { websiteEnabled }),
        ...(slotGapMinutes !== undefined && {
          slotGapMinutes: [5, 10, 15, 20].includes(Number(slotGapMinutes))
            ? Number(slotGapMinutes)
            : existing.slotGapMinutes,
        }),
        ...(typeof bookingFormEnabled === 'boolean' && { bookingFormEnabled }),
        ...(typeof bookingRequirePhone === 'boolean' && { bookingRequirePhone }),
        ...(typeof bookingRequireEmail === 'boolean' && { bookingRequireEmail }),
        ...(typeof bookingShowNotes === 'boolean' && { bookingShowNotes }),
        ...(bookingIntroText !== undefined && { bookingIntroText: bookingIntroText || null }),
        ...(bookingSuccessText !== undefined && { bookingSuccessText: bookingSuccessText || null }),
        ...(typeof bookingConfirmAuto === 'boolean' && { bookingConfirmAuto }),
        ...(plan && req.user!.role === 'SUPER_ADMIN' && { plan }),
        ...(typeof isActive === 'boolean' && req.user!.role === 'SUPER_ADMIN' && { isActive }),
      },
      include: {
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
        _count: { select: { users: true, bookings: true, services: true } },
      },
    });

    res.json(client);
  } catch (error) {
    console.error('Update client error:', error);
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
