import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { awardLoyaltyStampForBooking } from '../services/loyalty';

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
        stampColor: stampColor || '#5950b6',
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

    if (customerPhone) {
      const existingByPhone = await prisma.loyaltyCard.findUnique({
        where: {
          programId_customerPhone: {
            programId: program.id,
            customerPhone,
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
        customerPhone,
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
    const phone = req.query.phone as string;

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

export default router;
