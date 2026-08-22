import { Router, Request } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate, canAccessTenant, AuthRequest } from '../middleware/auth';
import { whatsappHandler } from '../services/whatsapp-handler';
import { whatsappService } from '../services/whatsapp';
import { getPlanLevel } from '../middleware/plan-check';
import { parseAddons } from '../middleware/plan-limits';

const router = Router();
const prisma = new PrismaClient();

function denyUnlessTenant(req: AuthRequest, res: import('express').Response, clientId: string) {
  if (!canAccessTenant(req, clientId)) {
    res.status(403).json({ error: 'Not authorized' });
    return false;
  }
  return true;
}

function extractWebhookToken(req: Request): string {
  const header = req.headers['x-webhook-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();

  const apikey = req.headers.apikey;
  if (typeof apikey === 'string' && apikey.trim()) return apikey.trim();

  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  const query = req.query.token;
  if (typeof query === 'string' && query.trim()) return query.trim();

  return typeof req.body?.token === 'string' ? req.body.token.trim() : '';
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (!provided || !expected || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function newWebhookToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: WhatsApp es un ADDON ($499/mes) además del plan PRO
async function requireWhatsappAddon(clientId: string): Promise<{ allowed: boolean; error?: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { plan: true, addons: true },
  });
  if (!client) return { allowed: false, error: 'Cliente no encontrado' };
  if (getPlanLevel(client.plan) < getPlanLevel('PRO')) {
    return { allowed: false, error: 'WhatsApp con IA requiere el plan PRO.' };
  }
  if (!parseAddons(client.addons).includes('WHATSAPP_AI')) {
    return {
      allowed: false,
      error: 'WhatsApp con IA es un addon de $499/mes aparte del plan. Actívalo desde Facturación o contacta a ventas.',
    };
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

    const providedToken = extractWebhookToken(req);
    if (!providedToken) {
      return res.status(401).json({ error: 'Webhook token required' });
    }

    const client = await prisma.client.findUnique({
      where: { slug: clientSlug },
      select: {
        id: true,
        plan: true,
        addons: true,
        whatsappConfig: { select: { webhookToken: true, isActive: true } },
      },
    });

    const expectedToken = client?.whatsappConfig?.webhookToken;
    if (!client || !expectedToken || !tokensMatch(providedToken, expectedToken)) {
      return res.status(401).json({ error: 'Invalid webhook token' });
    }

    if (
      getPlanLevel(client.plan) < getPlanLevel('PRO') ||
      !parseAddons(client.addons).includes('WHATSAPP_AI')
    ) {
      return res.status(403).json({ error: 'WhatsApp con IA no disponible: es un addon de $499/mes.' });
    }

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
    if (!denyUnlessTenant(req, res, clientId)) return;

    // Plan check
    const planCheck = await requireWhatsappAddon(clientId);
    if (!planCheck.allowed) {
      return res.status(403).json({ error: planCheck.error });
    }

    let config = await prisma.whatsAppConfig.findUnique({
      where: { clientId },
      select: {
        id: true,
        phoneNumberId: true,
        isOpenAIEnabled: true,
        aiPersonality: true,
        isActive: true,
        webhookToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (config && !config.webhookToken) {
      config = await prisma.whatsAppConfig.update({
        where: { clientId },
        data: { webhookToken: newWebhookToken() },
        select: {
          id: true,
          phoneNumberId: true,
          isOpenAIEnabled: true,
          aiPersonality: true,
          isActive: true,
          webhookToken: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

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
    if (!denyUnlessTenant(req, res, clientId)) return;

    // Plan check
    const planCheck = await requireWhatsappAddon(clientId);
    if (!planCheck.allowed) {
      return res.status(403).json({ error: planCheck.error });
    }

    const existing = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    const resolvedToken = webhookToken || existing?.webhookToken || newWebhookToken();

    let config;
    if (existing) {
      config = await prisma.whatsAppConfig.update({
        where: { clientId },
        data: {
          ...(phoneNumberId && { phoneNumberId }),
          ...(apiKey && { apiKey }),
          ...(instanceId !== undefined && { instanceId }),
          webhookToken: resolvedToken,
          ...(isOpenAIEnabled !== undefined && { isOpenAIEnabled }),
          ...(aiPersonality !== undefined && { aiPersonality }),
        },
      });
    } else {
      config = await prisma.whatsAppConfig.create({
        data: {
          clientId,
          phoneNumberId: phoneNumberId || '',
          apiKey: apiKey || '',
          instanceId: instanceId || `client_${clientId}`,
          webhookToken: resolvedToken,
          isOpenAIEnabled: isOpenAIEnabled ?? true,
          aiPersonality: aiPersonality || 'Eres un asistente amable y profesional de un negocio de belleza. Tu objetivo es ayudar a los clientes con información y reservar citas.',
          isActive: false,
        },
      });
    }

    res.json({
      id: config.id,
      phoneNumberId: config.phoneNumberId,
      isActive: config.isActive,
      webhookToken: config.webhookToken,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle WhatsApp active status
router.patch('/config/:clientId/toggle', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    if (!denyUnlessTenant(req, res, clientId)) return;

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

    if (!denyUnlessTenant(req, res, clientId)) return;

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

// Get QR code for client to scan (Business plan only)
router.get('/qr/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    if (!denyUnlessTenant(req, res, clientId)) return;

    const planCheck = await requireWhatsappAddon(clientId);
    if (!planCheck.allowed) {
      return res.status(403).json({ error: planCheck.error });
    }

    let config = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    const instanceName = `client_${clientId}`;

    if (!config) {
      await whatsappService.createInstance(instanceName);
      config = await prisma.whatsAppConfig.create({
        data: {
          clientId,
          phoneNumberId: '',
          apiKey: '',
          instanceId: instanceName,
          webhookToken: newWebhookToken(),
          isActive: false,
        },
      });
    } else if (!config.instanceId) {
      await whatsappService.createInstance(instanceName);
      config = await prisma.whatsAppConfig.update({
        where: { clientId },
        data: { instanceId: instanceName },
      });
    }

    const qrResponse = await whatsappService.getQRCode(config.instanceId || instanceName);

    res.json({
      qrCode: qrResponse.base64 || qrResponse.qrCode,
      instanceName: config.instanceId || instanceName,
      connected: config.isActive,
    });
  } catch (error: any) {
    console.error('[WhatsApp QR] Error:', error);
    res.status(500).json({ error: error.message || 'Error getting QR code' });
  }
});

// Check connection status by client instance
router.get('/connection/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    if (!denyUnlessTenant(req, res, clientId)) return;

    const planCheck = await requireWhatsappAddon(clientId);
    if (!planCheck.allowed) {
      return res.status(403).json({ error: planCheck.error });
    }

    const config = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!config) {
      return res.status(404).json({ error: 'WhatsApp config not found' });
    }

    const instanceName = config.instanceId || `client_${clientId}`;
    const connectionState = await whatsappService.getConnectionState(instanceName);
    const connected = connectionState === 'open' || connectionState === 'CONNECTED';

    if (connected && !config.isActive) {
      await prisma.whatsAppConfig.update({
        where: { clientId },
        data: { isActive: true },
      });
    }

    res.json({
      connected,
      state: connectionState,
      isActive: connected || config.isActive,
      phoneNumber: config.phoneNumberId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Disconnect WhatsApp
router.post('/disconnect/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    if (!denyUnlessTenant(req, res, clientId)) return;

    const planCheck = await requireWhatsappAddon(clientId);
    if (!planCheck.allowed) {
      return res.status(403).json({ error: planCheck.error });
    }

    const config = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!config) {
      return res.status(404).json({ error: 'WhatsApp config not found' });
    }

    const instanceName = config.instanceId || `client_${clientId}`;
    await whatsappService.disconnectInstance(instanceName);

    await prisma.whatsAppConfig.update({
      where: { clientId },
      data: { isActive: false },
    });

    res.json({ message: 'WhatsApp disconnected' });
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

    if (!denyUnlessTenant(req, res, clientId)) return;

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

    if (!denyUnlessTenant(req, res, clientId)) return;

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
