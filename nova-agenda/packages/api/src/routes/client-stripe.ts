import { Router, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

type StripeMode = 'test' | 'live';

function maskSecret(value: string | null): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 8)}••••••••${value.slice(-4)}`;
}

function maskPublishable(value: string | null): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 6)}••••••••${value.slice(-4)}`;
}

function getModeStatus(client: {
  stripeTestSecretKey: string | null;
  stripeTestPublishableKey: string | null;
  stripeTestWebhookSecret: string | null;
  stripeLiveSecretKey: string | null;
  stripeLivePublishableKey: string | null;
  stripeLiveWebhookSecret: string | null;
}) {
  return {
    test: {
      configured: Boolean(client.stripeTestSecretKey),
      hasSecretKey: Boolean(client.stripeTestSecretKey),
      hasPublishableKey: Boolean(client.stripeTestPublishableKey),
      hasWebhookSecret: Boolean(client.stripeTestWebhookSecret),
    },
    live: {
      configured: Boolean(client.stripeLiveSecretKey),
      hasSecretKey: Boolean(client.stripeLiveSecretKey),
      hasPublishableKey: Boolean(client.stripeLivePublishableKey),
      hasWebhookSecret: Boolean(client.stripeLiveWebhookSecret),
    },
  };
}

function buildResponse(
  mode: StripeMode,
  client: {
    stripeTestSecretKey: string | null;
    stripeTestPublishableKey: string | null;
    stripeTestWebhookSecret: string | null;
    stripeLiveSecretKey: string | null;
    stripeLivePublishableKey: string | null;
    stripeLiveWebhookSecret: string | null;
  }
) {
  const status = getModeStatus(client);
  const isLive = mode === 'live';
  const secretKey = isLive ? client.stripeLiveSecretKey : client.stripeTestSecretKey;
  const publishableKey = isLive ? client.stripeLivePublishableKey : client.stripeTestPublishableKey;
  const webhookSecret = isLive ? client.stripeLiveWebhookSecret : client.stripeTestWebhookSecret;

  return {
    mode,
    ...status,
    configured: status[mode].configured,
    // Valores enmascarados del modo activo (compatibilidad con la UI)
    secretKey: maskSecret(secretKey),
    publishableKey: maskPublishable(publishableKey),
    webhookSecret: webhookSecret ? '••••••••' : '',
    hasSecretKey: status[mode].hasSecretKey,
    hasPublishableKey: status[mode].hasPublishableKey,
    hasWebhookSecret: status[mode].hasWebhookSecret,
  };
}

// GET configuración de Stripe del negocio (solo el dueño del negocio)
router.get('/me/stripe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado a esta cuenta' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        stripeMode: true,
        stripeTestSecretKey: true,
        stripeTestPublishableKey: true,
        stripeTestWebhookSecret: true,
        stripeLiveSecretKey: true,
        stripeLivePublishableKey: true,
        stripeLiveWebhookSecret: true,
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const mode: StripeMode = client.stripeMode === 'live' ? 'live' : 'test';
    res.json(buildResponse(mode, client));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// PUT guarda la configuración de Stripe del negocio y permite cambiar de modo
// body: { mode?: 'test'|'live' (qué conjunto editar), secretKey?, publishableKey?, webhookSecret?, activeMode?: 'test'|'live' }
router.put('/me/stripe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado a esta cuenta' });
    }

    const existing = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        stripeMode: true,
        stripeTestSecretKey: true,
        stripeTestPublishableKey: true,
        stripeTestWebhookSecret: true,
        stripeLiveSecretKey: true,
        stripeLivePublishableKey: true,
        stripeLiveWebhookSecret: true,
      },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const { mode, secretKey, publishableKey, webhookSecret, activeMode } = req.body as {
      mode?: string;
      secretKey?: string;
      publishableKey?: string;
      webhookSecret?: string;
      activeMode?: string;
    };

    const clean = (v: string | undefined) => (v ?? '').trim();
    const nextSecretKey = clean(secretKey);
    const nextPublishableKey = clean(publishableKey);
    const nextWebhookSecret = clean(webhookSecret);

    // Determinar a qué conjunto de claves se guarda:
    // 1. `mode` explícito, 2. prefijo de la secret key, 3. modo activo actual
    let targetMode: StripeMode | null = null;
    if (mode === 'test' || mode === 'live') {
      targetMode = mode;
    } else if (nextSecretKey) {
      targetMode = nextSecretKey.startsWith('sk_test_') ? 'test' : 'live';
    } else {
      targetMode = existing.stripeMode === 'live' ? 'live' : 'test';
    }

    if (targetMode === 'test' && nextSecretKey && !nextSecretKey.startsWith('sk_test_')) {
      return res.status(400).json({ error: 'En modo prueba la clave secreta debe empezar con sk_test_.' });
    }
    if (targetMode === 'live' && nextSecretKey && !nextSecretKey.startsWith('sk_live_')) {
      return res.status(400).json({ error: 'En modo producción la clave secreta debe empezar con sk_live_.' });
    }

    if (nextSecretKey && !nextSecretKey.startsWith('sk_')) {
      return res.status(400).json({ error: 'La clave secreta debe empezar con sk_test_ o sk_live_.' });
    }

    if (nextPublishableKey && !nextPublishableKey.startsWith('pk_')) {
      return res.status(400).json({ error: 'La clave publicable debe empezar con pk_test_ o pk_live_.' });
    }
    if (nextPublishableKey) {
      const prefix = targetMode === 'test' ? 'pk_test_' : 'pk_live_';
      if (!nextPublishableKey.startsWith(prefix)) {
        return res.status(400).json({ error: `En modo ${targetMode === 'test' ? 'prueba' : 'producción'} la clave publicable debe empezar con ${prefix}.` });
      }
    }

    if (nextWebhookSecret && !nextWebhookSecret.startsWith('whsec_')) {
      return res.status(400).json({ error: 'El webhook secret debe empezar con whsec_.' });
    }

    // Verificar que las credenciales realmente funcionan contra Stripe
    if (nextSecretKey) {
      const stripe = new Stripe(nextSecretKey);
      try {
        await stripe.balance.retrieve();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('authentication')) {
          return res.status(400).json({ error: 'La clave secreta no es válida o no tiene permisos. Verifica que pertenezca a una cuenta Stripe activa.' });
        }
      }
    }

    // Si un campo llega vacío, conservar el valor guardado (no borrar secretos por error)
    const isTest = targetMode === 'test';
    const nextSecretKeyField = isTest ? 'stripeTestSecretKey' : 'stripeLiveSecretKey';
    const nextPublishableKeyField = isTest ? 'stripeTestPublishableKey' : 'stripeLivePublishableKey';
    const nextWebhookSecretField = isTest ? 'stripeTestWebhookSecret' : 'stripeLiveWebhookSecret';

    const nextActiveMode: StripeMode =
      activeMode === 'test' || activeMode === 'live' ? activeMode : existing.stripeMode === 'live' ? 'live' : 'test';

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(nextSecretKey !== '' ? { [nextSecretKeyField]: nextSecretKey } : {}),
        ...(nextPublishableKey !== '' ? { [nextPublishableKeyField]: nextPublishableKey } : {}),
        ...(nextWebhookSecret !== '' ? { [nextWebhookSecretField]: nextWebhookSecret } : {}),
        stripeMode: nextActiveMode,
      },
      select: {
        stripeMode: true,
        stripeTestSecretKey: true,
        stripeTestPublishableKey: true,
        stripeTestWebhookSecret: true,
        stripeLiveSecretKey: true,
        stripeLivePublishableKey: true,
        stripeLiveWebhookSecret: true,
      },
    });

    res.json(buildResponse(nextActiveMode, client));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[Client Stripe] Error saving config:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
