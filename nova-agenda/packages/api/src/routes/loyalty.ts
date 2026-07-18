import { Router, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { awardLoyaltyStampForBooking } from '../services/loyalty';
import { getPlanLevel } from '../middleware/plan-check';

const router = Router();
const prisma = new PrismaClient();

function resolveClientId(req: AuthRequest, bodyClientId?: string): string | null {
  if (req.user!.role === 'SUPER_ADMIN') {
    return bodyClientId || req.user!.clientId || null;
  }
  return req.user!.clientId || null;
}

function canAccessClient(req: AuthRequest, clientId: string): boolean {
  return req.user!.role === 'SUPER_ADMIN' || req.user!.clientId === clientId;
}

const programInclude = {
  rewards: { orderBy: { sortOrder: 'asc' as const } },
  _count: { select: { cards: true } },
};

const REWARD_TYPES = [
  'PERCENTAGE_DISCOUNT',
  'FIXED_AMOUNT',
  'FREE_SERVICE',
  'SERVICE_DISCOUNT',
  'CUSTOM',
] as const;

type RewardInput = {
  name?: string;
  description?: string;
  stampsRequired?: number;
  rewardType?: string;
  value?: number;
  serviceId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

function normalizeRewards(rewards: RewardInput[] | undefined, fallbackCardSize: number) {
  if (!Array.isArray(rewards) || rewards.length === 0) {
    return [
      {
        name: 'Descuento del 10%',
        description: 'Obtén un 10% de descuento en tu próxima visita',
        stampsRequired: Math.max(1, Math.floor(fallbackCardSize / 2)),
        rewardType: 'PERCENTAGE_DISCOUNT',
        value: 10,
        serviceId: null as string | null,
        isActive: true,
        sortOrder: 1,
      },
      {
        name: 'Servicio gratis',
        description: 'Obtén un servicio gratis al completar la tarjeta',
        stampsRequired: fallbackCardSize,
        rewardType: 'FREE_SERVICE',
        value: 0,
        serviceId: null as string | null,
        isActive: true,
        sortOrder: 2,
      },
    ];
  }

  return rewards
    .filter((r) => r && String(r.name || '').trim())
    .map((r, index) => {
      const rewardType = REWARD_TYPES.includes(r.rewardType as (typeof REWARD_TYPES)[number])
        ? (r.rewardType as string)
        : 'PERCENTAGE_DISCOUNT';
      const stampsRequired = Math.max(1, Number(r.stampsRequired) || fallbackCardSize);
      let value = Number(r.value);
      if (Number.isNaN(value)) value = rewardType === 'PERCENTAGE_DISCOUNT' ? 10 : 0;

      return {
        name: String(r.name).trim(),
        description: r.description ? String(r.description) : null,
        stampsRequired,
        rewardType,
        value,
        serviceId: r.serviceId || null,
        isActive: r.isActive !== false,
        sortOrder: r.sortOrder ?? index + 1,
      };
    });
}

// List loyalty programs
router.get('/programs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === 'SUPER_ADMIN') {
      const programs = await prisma.loyaltyProgram.findMany({
        include: programInclude,
        orderBy: { createdAt: 'desc' },
      });
      return res.json(programs);
    }

    if (!req.user!.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { clientId: req.user!.clientId },
      include: programInclude,
    });

    res.json(program ? [program] : []);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create loyalty program
router.post('/programs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = resolveClientId(req, req.body.clientId);

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      name,
      description,
      stampsToReward,
      stampIcon,
      stampColor,
      backgroundColor,
      textColor,
      enableWhatsApp,
      welcomeMessage,
      rewardMessage,
      isActive,
      rewards,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existing = await prisma.loyaltyProgram.findUnique({ where: { clientId } });
    if (existing) {
      return res.status(409).json({ error: 'Client already has a loyalty program' });
    }

    const cardSize = Math.max(1, Number(stampsToReward) || 10);
    const rewardRows = normalizeRewards(rewards, cardSize);

    const program = await prisma.loyaltyProgram.create({
      data: {
        clientId,
        name,
        description,
        stampsToReward: cardSize,
        isActive: isActive === true,
        stampIcon: stampIcon || 'local_fire_department',
        stampColor: stampColor || '#2dd4bf',
        backgroundColor: backgroundColor || '#ffffff',
        textColor: textColor || '#191c1e',
        enableWhatsApp: enableWhatsApp || false,
        welcomeMessage: welcomeMessage || '¡Bienvenido al programa de fidelidad! Recibirás un sello por cada visita.',
        rewardMessage: rewardMessage || '¡Felicitaciones! Has completado tu tarjeta y ganado una recompensa.',
        rewards: { create: rewardRows },
      },
      include: programInclude,
    });

    res.status(201).json(program);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update loyalty program
router.put('/programs/:clientId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;

    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      name,
      description,
      stampsToReward,
      stampIcon,
      stampColor,
      backgroundColor,
      textColor,
      enableWhatsApp,
      welcomeMessage,
      rewardMessage,
      isActive,
      rewards,
    } = req.body;

    const existing = await prisma.loyaltyProgram.findUnique({ where: { clientId } });
    if (!existing) {
      return res.status(404).json({ error: 'Loyalty program not found' });
    }

    const cardSize =
      stampsToReward !== undefined
        ? Math.max(1, Number(stampsToReward) || existing.stampsToReward)
        : existing.stampsToReward;

    if (Array.isArray(rewards)) {
      const rewardRows = normalizeRewards(rewards, cardSize);
      await prisma.loyaltyReward.deleteMany({ where: { programId: existing.id } });
      await prisma.loyaltyReward.createMany({
        data: rewardRows.map((r) => ({ ...r, programId: existing.id })),
      });
    }

    const program = await prisma.loyaltyProgram.update({
      where: { clientId },
      data: {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        stampsToReward: stampsToReward !== undefined ? cardSize : undefined,
        stampIcon: stampIcon || undefined,
        stampColor: stampColor || undefined,
        backgroundColor: backgroundColor || undefined,
        textColor: textColor || undefined,
        enableWhatsApp: enableWhatsApp !== undefined ? enableWhatsApp : undefined,
        welcomeMessage: welcomeMessage !== undefined ? welcomeMessage : undefined,
        rewardMessage: rewardMessage !== undefined ? rewardMessage : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
      include: programInclude,
    });

    res.json(program);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle loyalty program active state
router.patch('/programs/:clientId/toggle', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;

    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const program = await prisma.loyaltyProgram.findUnique({ where: { clientId } });
    if (!program) {
      return res.status(404).json({ error: 'Loyalty program not found' });
    }

    const updated = await prisma.loyaltyProgram.update({
      where: { clientId },
      data: { isActive: !program.isActive },
      include: programInclude,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete loyalty program
router.delete('/programs/:clientId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;

    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.loyaltyProgram.delete({ where: { clientId } });
    res.json({ message: 'Loyalty program deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '').trim();
}

// Register loyalty card from admin (BASIC+ — acceso por teléfono)
router.post('/cards/admin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId =
      req.user!.role === 'SUPER_ADMIN'
        ? (req.body.clientId as string) || req.user!.clientId
        : req.user!.clientId;

    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado' });
    }
    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { plan: true },
    });
    if (!client) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }
    if (getPlanLevel(client.plan) < getPlanLevel('BASIC')) {
      return res.status(403).json({
        error: 'Registrar tarjetas por teléfono requiere el plan Profesional o superior.',
        code: 'PLAN_UPGRADE_REQUIRED',
        requiredPlan: 'BASIC',
      });
    }

    const { customerName, customerEmail, customerPhone } = req.body;
    if (!customerName?.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }
    if (!customerPhone?.trim()) {
      return res.status(400).json({ error: 'El teléfono es obligatorio para acceder a la tarjeta' });
    }

    const phone = normalizePhone(customerPhone);
    if (phone.length < 8) {
      return res.status(400).json({ error: 'Ingresa un teléfono válido' });
    }

    const program = await prisma.loyaltyProgram.findUnique({ where: { clientId } });
    if (!program) {
      return res.status(400).json({
        error: 'Primero crea un programa de fidelidad en la pestaña Configuración.',
      });
    }

    const existing = await prisma.loyaltyCard.findUnique({
      where: {
        programId_customerPhone: { programId: program.id, customerPhone: phone },
      },
      include: {
        stamps: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { stamps: true } },
      },
    });

    if (existing) {
      return res.json({
        ...existing,
        visitsCount: existing.stampsEarned,
        alreadyExists: true,
      });
    }

    const card = await prisma.loyaltyCard.create({
      data: {
        programId: program.id,
        customerName: customerName.trim(),
        customerPhone: phone,
        customerEmail: customerEmail?.trim() || null,
      },
      include: {
        stamps: true,
        _count: { select: { stamps: true } },
      },
    });

    res.status(201).json({
      ...card,
      visitsCount: card.stampsEarned,
      alreadyExists: false,
    });
  } catch (error) {
    console.error('Admin loyalty card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List loyalty cards for a client (authenticated)
router.get('/cards', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = (req.query.clientId as string) || req.user!.clientId;

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const program = await prisma.loyaltyProgram.findUnique({ where: { clientId } });
    if (!program) {
      return res.json([]);
    }

    const cards = await prisma.loyaltyCard.findMany({
      where: { programId: program.id },
      include: {
        stamps: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { stamps: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(cards.map((card) => ({
      ...card,
      visitsCount: card.stampsEarned,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get client loyalty program (public)
router.get('/programs/client/:clientId', async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;

    const program = await prisma.loyaltyProgram.findUnique({
      where: { clientId },
      include: { rewards: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    });

    if (!program || !program.isActive) {
      return res.status(404).json({ error: 'Loyalty program not found' });
    }

    res.json(program);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create loyalty card for customer (public enrollment)
router.post('/cards', async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, customerName, customerEmail, customerPhone } = req.body;

    if (!clientId || !customerName) {
      return res.status(400).json({ error: 'Client ID and customer name are required' });
    }

    if (!customerEmail && !customerPhone) {
      return res.status(400).json({ error: 'Customer email or phone is required' });
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { clientId },
    });

    if (!program || !program.isActive) {
      return res.status(400).json({ error: 'Loyalty program not available' });
    }

    const phone = customerPhone ? normalizePhone(customerPhone) : null;

    if (phone) {
      const existingByPhone = await prisma.loyaltyCard.findUnique({
        where: {
          programId_customerPhone: {
            programId: program.id,
            customerPhone: phone,
          },
        },
      });
      if (existingByPhone) {
        return res.json(existingByPhone);
      }
    }

    if (customerEmail) {
      const existingByEmail = await prisma.loyaltyCard.findUnique({
        where: {
          programId_customerEmail: {
            programId: program.id,
            customerEmail,
          },
        },
      });
      if (existingByEmail) {
        return res.json(existingByEmail);
      }
    }

    const card = await prisma.loyaltyCard.create({
      data: {
        programId: program.id,
        customerName,
        customerEmail,
        customerPhone: phone,
      },
    });

    res.status(201).json(card);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add stamp to card manually (authenticated)
router.post('/cards/:cardId/stamps', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { cardId } = req.params;
    const { bookingId, serviceId } = req.body;

    const card = await prisma.loyaltyCard.findUnique({
      where: { id: cardId },
      include: { program: true },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (!canAccessClient(req, card.program.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!card.program.isActive) {
      return res.status(400).json({ error: 'Loyalty program not active' });
    }

    if (bookingId) {
      const existingStamp = await prisma.loyaltyStamp.findUnique({ where: { bookingId } });
      if (existingStamp) {
        return res.status(409).json({ error: 'Booking already has a loyalty stamp' });
      }
    }

    const newStampsEarned = card.stampsEarned + 1;
    const isCompleted = newStampsEarned >= card.program.stampsToReward && !card.isCompleted;

    const [stamp] = await prisma.$transaction([
      prisma.loyaltyStamp.create({
        data: {
          cardId,
          bookingId,
          serviceId,
          stampsGiven: 1,
        },
      }),
      prisma.loyaltyCard.update({
        where: { id: cardId },
        data: {
          stampsEarned: { increment: 1 },
          lastVisitAt: new Date(),
          ...(isCompleted ? { isCompleted: true, completedAt: new Date() } : {}),
        },
      }),
    ]);

    res.status(201).json(stamp);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if customer has loyalty card (public)
router.get('/cards/check', async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.query.clientId as string;
    const phone = normalizePhone((req.query.phone as string) || '');

    if (!clientId || !phone) {
      return res.status(400).json({ error: 'Client ID and phone are required' });
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { clientId },
    });

    if (!program?.isActive) {
      return res.status(404).json({ error: 'Loyalty program not available' });
    }

    const card = await prisma.loyaltyCard.findUnique({
      where: {
        programId_customerPhone: {
          programId: program.id,
          customerPhone: phone,
        },
      },
      include: { stamps: { orderBy: { createdAt: 'desc' } } },
    });

    if (!card) {
      return res.json(null);
    }

    res.json({ ...card, visitsCount: card.stampsEarned });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get customer's loyalty card with stamp count (public)
router.get('/cards/customer/:cardId', async (req: AuthRequest, res: Response) => {
  try {
    const { cardId } = req.params;

    const card = await prisma.loyaltyCard.findUnique({
      where: { id: cardId },
      include: {
        stamps: { orderBy: { createdAt: 'desc' } },
        program: { include: { rewards: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } } },
      },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({ ...card, visitsCount: card.stampsEarned });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Award stamp from completed booking (authenticated)
router.post('/bookings/:bookingId/stamp', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!canAccessClient(req, booking.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stamp = await awardLoyaltyStampForBooking(bookingId);
    if (!stamp) {
      return res.status(400).json({ error: 'Stamp could not be awarded' });
    }

    res.status(201).json(stamp);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate QR code for a loyalty card (authenticated)
router.post('/cards/:cardId/qr', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { cardId } = req.params;

    const card = await prisma.loyaltyCard.findUnique({
      where: { id: cardId },
      include: { program: true },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (!canAccessClient(req, card.program.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate QR code payload
    const payload = {
      cardId: card.id,
      programId: card.programId,
      clientId: card.program.clientId,
      phone: card.customerPhone,
      ts: Date.now(),
    };

    // Sign the payload
    const secret = card.program.qrSecret || crypto.randomBytes(32).toString('hex');
    if (!card.program.qrSecret) {
      await prisma.loyaltyProgram.update({
        where: { id: card.programId },
        data: { qrSecret: secret },
      });
    }

    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 16);

    const qrData = `${card.id}:${payload.ts}:${signature}`;

    // Generate QR code image URL (using a QR code API)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      JSON.stringify({ c: card.id, t: payload.ts, s: signature })
    )}`;

    // Update card with QR code if not already set
    if (!card.qrCode) {
      await prisma.loyaltyCard.update({
        where: { id: cardId },
        data: { qrCode: qrData },
      });
    }

    res.json({
      qrCode: qrData,
      qrCodeUrl,
      cardId: card.id,
      customerName: card.customerName,
      stampsEarned: card.stampsEarned,
      stampsToReward: card.program.stampsToReward,
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Scan QR code to add stamp (public - used by staff app or WhatsApp bot)
router.post('/qr/scan', async (req: AuthRequest, res: Response) => {
  try {
    const { qrData, staffId, note } = req.body;

    if (!qrData) {
      return res.status(400).json({ error: 'QR data is required' });
    }

    // Parse QR data: cardId:timestamp:signature
    const parts = qrData.split(':');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    const [cardId, timestamp, signature] = parts;

    // Find the card
    const card = await prisma.loyaltyCard.findUnique({
      where: { id: cardId },
      include: { program: true },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (!card.program.isActive) {
      return res.status(400).json({ error: 'Loyalty program is not active' });
    }

    // Verify signature
    const secret = card.program.qrSecret;
    if (!secret) {
      return res.status(400).json({ error: 'QR code not properly configured' });
    }

    const payload = {
      cardId: card.id,
      programId: card.programId,
      clientId: card.program.clientId,
      phone: card.customerPhone,
      ts: parseInt(timestamp),
    };

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 16);

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid QR code signature' });
    }

    // Check if QR code is too old (24 hours)
    const qrAge = Date.now() - parseInt(timestamp);
    if (qrAge > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'QR code has expired. Please generate a new one.' });
    }

    // Check if customer already got a stamp today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStamp = await prisma.loyaltyStamp.findFirst({
      where: {
        cardId,
        createdAt: { gte: today },
      },
    });

    if (todayStamp) {
      return res.status(409).json({
        error: 'Customer already received a stamp today',
        nextStampAt: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Award stamp
    const newStampsEarned = card.stampsEarned + 1;
    const isCompleted = newStampsEarned >= card.program.stampsToReward && !card.isCompleted;

    const [stamp] = await prisma.$transaction([
      prisma.loyaltyStamp.create({
        data: {
          cardId,
          stampsGiven: 1,
          note: note || 'QR Scan',
        },
      }),
      prisma.loyaltyCard.update({
        where: { id: cardId },
        data: {
          stampsEarned: { increment: 1 },
          lastVisitAt: new Date(),
          ...(isCompleted ? { isCompleted: true, completedAt: new Date() } : {}),
        },
      }),
    ]);

    // Get updated card with program info
    const updatedCard = await prisma.loyaltyCard.findUnique({
      where: { id: cardId },
      include: {
        program: { include: { rewards: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } } },
        stamps: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    res.status(201).json({
      stamp,
      card: updatedCard,
      isCompleted,
      stampsEarned: newStampsEarned,
      stampsToReward: card.program.stampsToReward,
      message: isCompleted
        ? card.program.rewardMessage || '¡Felicitaciones! Has completado tu tarjeta.'
        : `¡Sello añadido! ${newStampsEarned}/${card.program.stampsToReward}`,
    });
  } catch (error) {
    console.error('QR scan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate card image (authenticated)
router.post('/cards/:cardId/image', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { cardId } = req.params;

    const card = await prisma.loyaltyCard.findUnique({
      where: { id: cardId },
      include: { program: true },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (!canAccessClient(req, card.program.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate card image URL (using a template service)
    const cardImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x400&data=${encodeURIComponent(
      JSON.stringify({
        type: 'loyalty-card',
        cardId: card.id,
        program: card.program.name,
        customer: card.customerName,
        stamps: `${card.stampsEarned}/${card.program.stampsToReward}`,
      })
    )}`;

    // Update card with image URL
    await prisma.loyaltyCard.update({
      where: { id: cardId },
      data: { cardImageUrl },
    });

    res.json({ cardImageUrl });
  } catch (error) {
    console.error('Card image generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send card via WhatsApp (authenticated)
router.post('/cards/:cardId/whatsapp', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { cardId } = req.params;
    const { message } = req.body;

    const card = await prisma.loyaltyCard.findUnique({
      where: { id: cardId },
      include: { program: true },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (!canAccessClient(req, card.program.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!card.customerPhone) {
      return res.status(400).json({ error: 'Customer phone is required' });
    }

    if (!card.program.enableWhatsApp) {
      return res.status(400).json({ error: 'WhatsApp is not enabled for this program' });
    }

    // Generate QR code URL for the card
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      JSON.stringify({ c: card.id })
    )}`;

    // Default message
    const defaultMessage = `¡Hola ${card.customerName}! 🎉\n\n` +
      `Tu tarjeta de fidelidad de ${card.program.name}:\n` +
      `Sellos: ${card.stampsEarned}/${card.program.stampsToReward}\n\n` +
      `Muestra este QR en tu próxima visita:\n${qrCodeUrl}`;

    // TODO: Integrate with WhatsApp API to send the message
    // For now, return the message and QR code URL
    res.json({
      message: message || defaultMessage,
      qrCodeUrl,
      customerPhone: card.customerPhone,
      sent: false, // Set to true when WhatsApp integration is complete
    });
  } catch (error) {
    console.error('WhatsApp card send error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get card QR code (public - for customer to view their QR)
router.get('/cards/:cardId/qr', async (req: AuthRequest, res: Response) => {
  try {
    const { cardId } = req.params;

    const card = await prisma.loyaltyCard.findUnique({
      where: { id: cardId },
      include: { program: true },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Generate QR code payload
    const payload = {
      cardId: card.id,
      ts: Date.now(),
    };

    const secret = card.program.qrSecret || crypto.randomBytes(32).toString('hex');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 16);

    const qrData = `${card.id}:${payload.ts}:${signature}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      JSON.stringify({ c: card.id, t: payload.ts, s: signature })
    )}`;

    res.json({
      qrCode: qrData,
      qrCodeUrl,
      cardId: card.id,
      customerName: card.customerName,
      stampsEarned: card.stampsEarned,
      stampsToReward: card.program.stampsToReward,
    });
  } catch (error) {
    console.error('QR code fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
