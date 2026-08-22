import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ADDON_KEYS, parseAddons } from '../middleware/plan-limits';

function sanitizeAddonList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((key): key is string => typeof key === 'string' && (ADDON_KEYS as readonly string[]).includes(key));
}
import { sanitizeClient, sanitizeClients } from '../utils/sanitize-client';

const router = Router();
const prisma = new PrismaClient();

function canAccessClient(req: AuthRequest, clientId: string) {
  return req.user!.role === 'SUPER_ADMIN' || req.user!.clientId === clientId;
}

const VALID_PLANS = ['FREE', 'PRO', 'CUSTOM'] as const;

class OwnerAccessError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function setClientOwnerAccess(params: {
  clientId: string;
  email: string;
  password?: string;
  name?: string;
  requirePassword?: boolean;
}) {
  const email = params.email.trim();
  if (!email) {
    throw new OwnerAccessError(400, 'El correo del dueño es obligatorio para crear el acceso.');
  }
  if (params.requirePassword && !params.password) {
    throw new OwnerAccessError(400, 'La contraseña es obligatoria.');
  }
  if (params.password && params.password.length < 6) {
    throw new OwnerAccessError(400, 'La contraseña debe tener al menos 6 caracteres.');
  }

  const owner = await prisma.user.findFirst({
    where: { clientId: params.clientId, role: { in: ['ADMIN', 'CLIENT'] } },
    orderBy: { createdAt: 'asc' },
  });

  const emailTaken = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      ...(owner ? { NOT: { id: owner.id } } : {}),
    },
  });
  if (emailTaken) {
    throw new OwnerAccessError(409, 'Ese correo ya está registrado en otra cuenta.');
  }

  const hashed = params.password ? await bcrypt.hash(params.password, 10) : undefined;
  const name = params.name?.trim() || email.split('@')[0];

  if (owner) {
    return prisma.user.update({
      where: { id: owner.id },
      data: {
        email,
        ...(hashed && { password: hashed }),
        ...(params.name !== undefined && { name }),
        role: owner.role === 'SUPER_ADMIN' ? owner.role : 'ADMIN',
      },
    });
  }

  if (!hashed) {
    throw new OwnerAccessError(400, 'La contraseña es obligatoria para crear el acceso.');
  }

  return prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      role: 'ADMIN',
      clientId: params.clientId,
    },
  });
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
    res.json(sanitizeClients(clients.map((c) => ({ ...c, addons: parseAddons(c.addons) }))));
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

    res.json(sanitizeClient({ ...client, addons: parseAddons(client.addons) }));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create client (super admin only)
router.post('/', authenticate, authorize('SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, email, phone, address, primaryColor, plan, addons, password, ownerName } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios para el acceso del negocio.' });
    }

    const resolvedPlan = (VALID_PLANS as readonly string[]).includes(plan) ? plan : 'FREE';

    const existing = await prisma.client.findFirst({
      where: { OR: [{ slug }, { email: email.trim() }] },
    });

    if (existing) {
      return res.status(409).json({ error: 'Client with this slug or email already exists' });
    }

    const emailTaken = await prisma.user.findFirst({
      where: { email: { equals: String(email).trim(), mode: 'insensitive' } },
    });
    if (emailTaken) {
      return res.status(409).json({ error: 'Ese correo ya está registrado en otra cuenta.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const client = await prisma.client.create({
      data: {
        name,
        slug,
        email: email.trim(),
        phone,
        address,
        primaryColor: primaryColor || '#2dd4bf',
        plan: resolvedPlan,
        ...(Array.isArray(addons) && { addons: JSON.stringify(sanitizeAddonList(addons)) }),
        users: {
          create: {
            email: email.trim(),
            password: hashedPassword,
            name: (ownerName || name || email).toString().trim(),
            role: 'ADMIN',
          },
        },
        workingHours: {
          create: DEFAULT_WORKING_HOURS,
        },
      },
    });

    res.status(201).json(sanitizeClient({ ...client, addons: parseAddons(client.addons) }));
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
      addons,
      password,
      ownerName,
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
        error: 'La página web personalizada requiere el plan PRO o superior.',
        code: 'PLAN_UPGRADE_REQUIRED',
        requiredPlan: 'PRO',
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
        ...(Array.isArray(addons) && req.user!.role === 'SUPER_ADMIN' && { addons: JSON.stringify(sanitizeAddonList(addons)) }),
      },
      include: {
        workingHours: { orderBy: { dayOfWeek: 'asc' } },
        _count: { select: { users: true, bookings: true, services: true } },
      },
    });

    if (req.user!.role === 'SUPER_ADMIN' && (password || email)) {
      const owner = await prisma.user.findFirst({
        where: { clientId: id, role: { in: ['ADMIN', 'CLIENT'] } },
      });
      if (password || owner) {
        try {
          await setClientOwnerAccess({
            clientId: id,
            email: String(email || existing.email || ''),
            password: password || undefined,
            name: ownerName,
            requirePassword: Boolean(password) && !owner,
          });
        } catch (err) {
          if (err instanceof OwnerAccessError) {
            return res.status(err.status).json({ error: err.message });
          }
          throw err;
        }
      }
    }

    res.json(sanitizeClient({ ...client, addons: parseAddons(client.addons) }));
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
