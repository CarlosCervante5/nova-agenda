import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate, canAccessTenant, AuthRequest } from '../middleware/auth';
import { whatsappHandler } from '../services/whatsapp-handler';
import { fromWhatsAppAddress, hasTwilioCredentials, normalizeE164, whatsappService } from '../services/whatsapp';
import { getPlanLevel } from '../middleware/plan-check';
import { parseAddons } from '../middleware/plan-limits';
import { config as appConfig } from '../config';

const router = Router();
const prisma = new PrismaClient();

function denyUnlessTenant(req: AuthRequest, res: Response, clientId: string) {
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

function publicApiBase(req: Request) {
  if (appConfig.publicApiUrl) return appConfig.publicApiUrl;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
  return `${proto}://${req.get('host')}`;
}

function twilioWebhookUrl(req: Request, slug: string) {
  return `${publicApiBase(req)}/api/whatsapp/twilio/webhook/${encodeURIComponent(slug)}`;
}

function maskSecret(value?: string | null) {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}

function twilioFromRow(row: { twilioAccountSid: string; twilioAuthToken: string; phoneNumberId: string }) {
  return {
    accountSid: row.twilioAccountSid,
    authToken: row.twilioAuthToken,
    fromNumber: row.phoneNumberId,
  };
}

function serializeConfig(
  req: Request,
  clientSlug: string,
  row: {
    id: string;
    phoneNumberId: string;
    twilioAccountSid: string;
    twilioAuthToken: string;
    isOpenAIEnabled: boolean;
    aiPersonality: string;
    isActive: boolean;
    webhookToken: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return {
    id: row.id,
    provider: 'TWILIO',
    phoneNumberId: row.phoneNumberId,
    twilioAccountSid: row.twilioAccountSid,
    twilioAuthTokenMasked: maskSecret(row.twilioAuthToken),
    hasAuthToken: Boolean(row.twilioAuthToken),
    isConfigured: hasTwilioCredentials(twilioFromRow(row)),
    isOpenAIEnabled: row.isOpenAIEnabled,
    aiPersonality: row.aiPersonality,
    isActive: row.isActive,
    webhookUrl: twilioWebhookUrl(req, clientSlug),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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

async function clientSlugById(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { slug: true } });
  return client?.slug || '';
}

router.post('/twilio/webhook/:clientSlug', async (req, res) => {
  try {
    const { clientSlug } = req.params;
    const client = await prisma.client.findUnique({
      where: { slug: clientSlug },
      select: {
        id: true,
        plan: true,
        addons: true,
        whatsappConfig: true,
      },
    });

    const wa = client?.whatsappConfig;
    if (!client || !wa?.twilioAuthToken) {
      return res.status(404).type('text/xml').send('<Response></Response>');
    }

    const signature = String(req.headers['x-twilio-signature'] || '');
    const params = Object.fromEntries(
      Object.entries(req.body || {}).map(([key, value]) => [key, String(value ?? '')])
    );
    const url = twilioWebhookUrl(req, clientSlug);
    const valid = whatsappService.validateWebhookSignature(wa.twilioAuthToken, signature, url, params);
    if (!valid) {
      console.warn('[WhatsApp Twilio] Firma inválida para', clientSlug);
      return res.status(403).type('text/xml').send('<Response></Response>');
    }

    if (wa.twilioAccountSid && params.AccountSid && params.AccountSid !== wa.twilioAccountSid) {
      return res.status(403).type('text/xml').send('<Response></Response>');
    }

    if (
      getPlanLevel(client.plan) < getPlanLevel('PRO') ||
      !parseAddons(client.addons).includes('WHATSAPP_AI')
    ) {
      return res.status(403).type('text/xml').send('<Response></Response>');
    }

    const phone = fromWhatsAppAddress(params.From || '');
    const message = (params.Body || '').trim();
    if (phone && message && wa.isActive) {
      whatsappHandler.processIncomingMessage({
        phone,
        message,
        timestamp: new Date().toISOString(),
        clientSlug,
      }).catch((err) => console.error('[WhatsApp Twilio] Error processing:', err));
    }

    res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error('[WhatsApp Twilio] Webhook error:', error);
    res.status(200).type('text/xml').send('<Response></Response>');
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const { phone, message, timestamp, clientSlug } = req.body;
    if (!phone || !message || !clientSlug) {
      return res.status(400).json({ error: 'Missing required fields: phone, message, clientSlug' });
    }

    const providedToken = extractWebhookToken(req);
    if (!providedToken) return res.status(401).json({ error: 'Webhook token required' });

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
    }).catch((err) => console.error('[WhatsApp Webhook] Error processing:', err));

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/config/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    if (!denyUnlessTenant(req, res, clientId)) return;
    const planCheck = await requireWhatsappAddon(clientId);
    if (!planCheck.allowed) return res.status(403).json({ error: planCheck.error });

    const slug = await clientSlugById(clientId);
    const row = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!row) {
      return res.json({
        provider: 'TWILIO',
        phoneNumberId: '',
        twilioAccountSid: '',
        twilioAuthTokenMasked: '',
        hasAuthToken: false,
        isConfigured: false,
        isOpenAIEnabled: true,
        aiPersonality:
          'Eres un asistente amable y profesional de un negocio de belleza. Tu objetivo es ayudar a los clientes con información y reservar citas.',
        isActive: false,
        webhookUrl: slug ? twilioWebhookUrl(req, slug) : '',
      });
    }

    res.json(serializeConfig(req, slug, row));
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

router.put('/config/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { phoneNumberId, twilioAccountSid, twilioAuthToken, isOpenAIEnabled, aiPersonality, isActive } = req.body;
    if (!denyUnlessTenant(req, res, clientId)) return;
    const planCheck = await requireWhatsappAddon(clientId);
    if (!planCheck.allowed) return res.status(403).json({ error: planCheck.error });

    const existing = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    const sid = String(twilioAccountSid ?? existing?.twilioAccountSid ?? '').trim();
    const from = normalizeE164(String(phoneNumberId ?? existing?.phoneNumberId ?? ''));
    const incomingToken = typeof twilioAuthToken === 'string' ? twilioAuthToken.trim() : '';
    const tokenLooksMasked = incomingToken.includes('•') || incomingToken.includes('*');
    const authToken = incomingToken && !tokenLooksMasked ? incomingToken : (existing?.twilioAuthToken || '');

    if (sid && !sid.startsWith('AC')) {
      return res.status(400).json({ error: 'El Account SID de Twilio debe empezar con AC' });
    }

    const data = {
      provider: 'TWILIO',
      phoneNumberId: from,
      twilioAccountSid: sid,
      twilioAuthToken: authToken,
      webhookToken: existing?.webhookToken || newWebhookToken(),
      ...(isOpenAIEnabled !== undefined && { isOpenAIEnabled: Boolean(isOpenAIEnabled) }),
      ...(aiPersonality !== undefined && { aiPersonality: String(aiPersonality) }),
      ...(typeof isActive === 'boolean' && { isActive }),
    };

    const row = existing
      ? await prisma.whatsAppConfig.update({ where: { clientId }, data })
      : await prisma.whatsAppConfig.create({
          data: {
            clientId,
            apiKey: '',
            isActive: typeof isActive === 'boolean' ? isActive : false,
            ...data,
          },
        });

    const slug = await clientSlugById(clientId);
    res.json(serializeConfig(req, slug, row));
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

router.patch('/config/:clientId/toggle', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    if (!denyUnlessTenant(req, res, clientId)) return;
    const config = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!config) return res.status(404).json({ error: 'Guarda primero las credenciales de Twilio' });

    if (!config.isActive && !hasTwilioCredentials(twilioFromRow(config))) {
      return res.status(400).json({ error: 'Completa Account SID, Auth Token y el número de WhatsApp' });
    }

    const updated = await prisma.whatsAppConfig.update({
      where: { clientId },
      data: { isActive: !config.isActive },
    });
    res.json({ isActive: updated.isActive });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

router.get('/config/:clientId/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    if (!denyUnlessTenant(req, res, clientId)) return;
    const row = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!row) return res.json({ connected: false, isActive: false, isConfigured: false });
    const connected = await whatsappService.checkConnection(twilioFromRow(row));
    res.json({ connected, isActive: row.isActive, isConfigured: hasTwilioCredentials(twilioFromRow(row)) });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

router.get('/connection/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    if (!denyUnlessTenant(req, res, clientId)) return;
    const planCheck = await requireWhatsappAddon(clientId);
    if (!planCheck.allowed) return res.status(403).json({ error: planCheck.error });

    const row = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!row || !hasTwilioCredentials(twilioFromRow(row))) {
      return res.json({ connected: false, state: 'missing', isActive: false, phoneNumber: '' });
    }

    const connected = await whatsappService.checkConnection(twilioFromRow(row));
    res.json({
      connected,
      state: connected ? 'ready' : 'invalid',
      isActive: row.isActive,
      phoneNumber: row.phoneNumberId,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

router.get('/logs/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    if (!denyUnlessTenant(req, res, clientId)) return;

    const [logs, total] = await Promise.all([
      prisma.whatsAppLog.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.whatsAppLog.count({ where: { clientId } }),
    ]);
    res.json({ logs, total });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

router.post('/test/:clientId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { phone, message } = req.body;
    if (!denyUnlessTenant(req, res, clientId)) return;

    const row = await prisma.whatsAppConfig.findUnique({ where: { clientId } });
    if (!row || !hasTwilioCredentials(twilioFromRow(row))) {
      return res.status(400).json({ error: 'Guarda las credenciales de Twilio antes de enviar una prueba' });
    }

    const sent = await whatsappService.sendMessage(String(phone || ''), String(message || ''), twilioFromRow(row));
    if (sent) {
      await prisma.whatsAppLog.create({
        data: {
          clientId,
          phoneNumber: normalizeE164(String(phone || '')),
          direction: 'OUTBOUND',
          message: String(message || ''),
          intent: 'TEST',
        },
      });
    }
    if (!sent) return res.status(502).json({ error: 'Twilio no pudo enviar el mensaje. Revisa número y credenciales.' });
    res.json({ sent: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
  }
});

export default router;
