import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { whatsappHandler } from '../services/whatsapp-handler';
import { whatsappService } from '../services/whatsapp';
import { getPlanLevel } from '../middleware/plan-check';

const router = Router();
const prisma = new PrismaClient();

// Helper: check if client has PRO plan
async function requireProPlan(clientId: string): Promise<{ allowed: boolean; error?: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { plan: true },
  });
  if (!client) return { allowed: false, error: 'Cliente no encontrado' };
  if (getPlanLevel(client.plan) < getPlanLevel('PRO')) {
    return { allowed: false, error: 'WhatsApp requiere el plan Business (PRO)' };
  }
  return { allowed: true };
}

// Webhook endpoint - receives messages from Evo Cloud
router.post('/webhook', async (req, res) => {
  try {
    const { phone, message, timestamp, clientSlug } = req.body;

    if (!phone || !message || !clientSlug) {
      return res.status(400).json({ error: 'Missing required fields: phone, message, clientSlug' });
    }

    // Check plan before processing
    const client = await prisma.client.findUnique({
      where: { slug: clientSlug },
      select: { id: true, plan: true },
    });

    if (!client || getPlanLevel(client.plan) < getPlanLevel('PRO')) {
      return res.status(403).json({ error: 'WhatsApp no disponible para este plan' });
    }

    // Process asynchronously to respond to webhook quickly
    whatsappHandler.processIncomingMessage({
      phone,
      message,
      timestamp,
      clientSlug,
    }).catch(err => console.error('[WhatsApp Webhook] Error processing:', err));

    res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get WhatsApp config for a client
router.get('/config/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    // Authorization check
    if (req.user?.role === 'CLIENT' && req.user?.clientId !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Plan check
    const planCheck = await requireProPlan(clientId);
    if (!planCheck.allowed) {
      return res.status(403).json({ error: planCheck.error });
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { clientId },
      select: {
        id: true,
        phoneNumberId: true,
        isOpenAIEnabled: true,
        aiPersonality: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(config || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create or update WhatsApp config
router.put('/config/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { phoneNumberId, apiKey, instanceId, webhookToken, isOpenAIEnabled, aiPersonality } = req.body;

    // Authorization check
    if (req.user?.role === 'CLIENT' && req.user?.clientId !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Plan check
    const planCheck = await requireProPlan(clientId);
    if (!planCheck.allowed) {
      return res.status(403).json({ error: planCheck.error });
    }

    const existing = await prisma.whatsAppConfig.findUnique({ where: { clientId } });

    let config;
    if (existing) {
      config = await prisma.whatsAppConfig.update({
        where: { clientId },
        data: {
          ...(phoneNumberId && { phoneNumberId }),
          ...(apiKey && { apiKey }),
          ...(instanceId !== undefined && { instanceId }),
          ...(webhookToken !== undefined && { webhookToken }),
          ...(isOpenAIEnabled !== undefined && { isOpenAIEnabled }),
          ...(aiPersonality !== undefined && { aiPersonality }),
        },
      });
    } else {
      if (!phoneNumberId || !apiKey) {
        return res.status(400).json({ error: 'phoneNumberId and apiKey are required' });
      }
      config = await prisma.whatsAppConfig.create({
        data: {
          clientId,
          phoneNumberId,
          apiKey,
          instanceId,
          webhookToken,
          isOpenAIEnabled: isOpenAIEnabled ?? true,
          aiPersonality: aiPersonality || 'Eres un asistente amable y profesional de un negocio de belleza. Tu objetivo es ayudar a los clientes con información y reservar citas.',
        },
      });
    }

    res.json({ id: config.id, phoneNumberId: config.phoneNumberId, isActive: config.isActive });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle WhatsApp active status
router.patch('/config/:clientId/toggle', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    if (req.user?.role === 'CLIENT' && req.user?.clientId !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const config = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!config) {
      return res.status(404).json({ error: 'WhatsApp config not found' });
    }

    const updated = await prisma.whatsAppConfig.update({
      where: { clientId },
      data: { isActive: !config.isActive },
    });

    res.json({ isActive: updated.isActive });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check WhatsApp connection status
router.get('/config/:clientId/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    if (req.user?.role === 'CLIENT' && req.user?.clientId !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const config = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!config) {
      return res.status(404).json({ error: 'WhatsApp config not found' });
    }

    const connected = await whatsappService.checkConnection({
      phoneNumberId: config.phoneNumberId,
      apiKey: config.apiKey,
      instanceId: config.instanceId || undefined,
    });

    res.json({ connected, isActive: config.isActive });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get WhatsApp logs for a client
router.get('/logs/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (req.user?.role === 'CLIENT' && req.user?.clientId !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const logs = await prisma.whatsAppLog.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.whatsAppLog.count({ where: { clientId } });

    res.json({ logs, total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send a test message
router.post('/test/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { phone, message } = req.body;

    if (req.user?.role === 'CLIENT' && req.user?.clientId !== clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const config = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!config) {
      return res.status(404).json({ error: 'WhatsApp config not found' });
    }

    const sent = await whatsappService.sendMessage(phone, message, {
      phoneNumberId: config.phoneNumberId,
      apiKey: config.apiKey,
      instanceId: config.instanceId || undefined,
    });

    res.json({ sent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
