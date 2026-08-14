import { Router, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

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

function inferMode(secretKey: string | null): 'test' | 'live' | null {
  if (!secretKey) return null;
  return secretKey.startsWith('sk_test_') ? 'test' : 'live';
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
        stripeSecretKey: true,
        stripePublishableKey: true,
        stripeWebhookSecret: true,
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const configured = Boolean(client.stripeSecretKey);

    res.json({
      configured,
      mode: inferMode(client.stripeSecretKey),
      secretKey: maskSecret(client.stripeSecretKey),
      publishableKey: maskPublishable(client.stripePublishableKey),
      webhookSecret: client.stripeWebhookSecret ? '••••••••' : '',
      hasSecretKey: configured,
      hasPublishableKey: Boolean(client.stripePublishableKey),
      hasWebhookSecret: Boolean(client.stripeWebhookSecret),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// PUT guarda la configuración de Stripe del negocio
router.put('/me/stripe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado a esta cuenta' });
    }

    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (!existing) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const { secretKey, publishableKey, webhookSecret } = req.body as {
      secretKey?: string;
      publishableKey?: string;
      webhookSecret?: string;
    };

    const clean = (v: string | undefined) => (v ?? '').trim();

    const nextSecretKey = clean(secretKey);
    if (nextSecretKey && !nextSecretKey.startsWith('sk_')) {
      return res.status(400).json({ error: 'La clave secreta debe empezar con sk_test_ o sk_live_.' });
    }

    const nextPublishableKey = clean(publishableKey);
    if (nextPublishableKey && !nextPublishableKey.startsWith('pk_')) {
      return res.status(400).json({ error: 'La clave publicable debe empezar con pk_test_ o pk_live_.' });
    }

    const nextWebhookSecret = clean(webhookSecret);
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
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(nextSecretKey !== '' ? { stripeSecretKey: nextSecretKey } : {}),
        ...(nextPublishableKey !== '' ? { stripePublishableKey: nextPublishableKey } : {}),
        ...(nextWebhookSecret !== '' ? { stripeWebhookSecret: nextWebhookSecret } : {}),
      },
      select: {
        stripeSecretKey: true,
        stripePublishableKey: true,
        stripeWebhookSecret: true,
      },
    });

    res.json({
      configured: Boolean(client.stripeSecretKey),
      mode: inferMode(client.stripeSecretKey),
      secretKey: maskSecret(client.stripeSecretKey),
      publishableKey: maskPublishable(client.stripePublishableKey),
      webhookSecret: client.stripeWebhookSecret ? '••••••••' : '',
      hasSecretKey: Boolean(client.stripeSecretKey),
      hasPublishableKey: Boolean(client.stripePublishableKey),
      hasWebhookSecret: Boolean(client.stripeWebhookSecret),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[Client Stripe] Error saving config:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
