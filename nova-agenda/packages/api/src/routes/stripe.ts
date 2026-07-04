import { Router, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getClientPlanUsage } from '../middleware/plan-limits';
import {
  getStripeClient,
  getStripeWebhookSecret,
  getPriceIdForPlan,
  getPlanForPriceId,
  isStripeConfigured,
  formatStripeError,
} from '../services/stripe-config';

const router = Router();
const prisma = new PrismaClient();

const PLANS: Record<string, { name: string; price: number; features: string[] }> = {
  FREE: { name: 'Gratuito', price: 0, features: ['Agenda de citas', 'Formulario de reservas compartible', 'Hasta 3 servicios', 'Hasta 50 citas/mes'] },
  BASIC: { name: 'Profesional', price: 49, features: ['Todo del plan Gratuito', 'Hasta 20 servicios', 'Citas ilimitadas', 'Dominio propio', 'Recordatorios SMS'] },
  PRO: { name: 'Business', price: 99, features: ['Todo del plan Profesional', 'WhatsApp con IA integrada', 'Chatbot 24/7', 'Servicios ilimitados'] },
};

function getAdminOrigin(req: AuthRequest): string {
  return (req.headers.origin as string) || process.env.ADMIN_URL || 'http://localhost:3002';
}

// Get available plans + current subscription info
router.get('/plans', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado a esta cuenta' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { plan: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });

    if (!client) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    let subscription: Record<string, unknown> | null = null;
    if (client.stripeSubscriptionId) {
      try {
        const s = await getStripeClient();
        const sub = await s.subscriptions.retrieve(client.stripeSubscriptionId);
        subscription = {
          id: sub.id,
          status: sub.status,
          currentPeriodEnd: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
          cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        };
      } catch {
        // Subscription may not exist in Stripe yet
      }
    }

    const stripeStatus = await isStripeConfigured();

    res.json({
      currentPlan: client.plan,
      plans: PLANS,
      subscription,
      usage: await getClientPlanUsage(clientId, client.plan),
      stripeConfigured: stripeStatus.configured,
      stripeMissing: stripeStatus.missing,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    res.status(500).json({ error: message });
  }
});

// Create Stripe Checkout Session for subscription upgrade
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    const { plan } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado a esta cuenta' });
    }

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Plan inválido' });
    }

    if (plan === 'FREE') {
      return res.status(400).json({ error: 'No se puede crear checkout para el plan gratuito' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, email: true, slug: true, stripeCustomerId: true },
    });

    if (!client) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const priceId = await getPriceIdForPlan(plan);
    const s = await getStripeClient();
    const origin = getAdminOrigin(req);

    let customerId = client.stripeCustomerId;

    if (!customerId) {
      const customer = await s.customers.create({
        name: client.name,
        email: client.email || undefined,
        metadata: { clientId: client.id, clientSlug: client.slug },
      });
      customerId = customer.id;

      await prisma.client.update({
        where: { id: client.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { clientId: client.id, plan },
      subscription_data: {
        metadata: { clientId: client.id, plan },
      },
      success_url: `${origin}/dashboard/billing?success=true`,
      cancel_url: `${origin}/dashboard/billing?canceled=true`,
    });

    if (!session.url) {
      return res.status(502).json({ error: 'Stripe no devolvió URL de checkout' });
    }

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: unknown) {
    const message = formatStripeError(error);
    console.error('[Stripe Checkout]', message, error);
    const isConfigError =
      message.includes('no está configurado') ||
      message.includes('no configurado') ||
      message.includes('no es válido') ||
      message.includes('Price ID');
    res.status(isConfigError ? 503 : 500).json({ error: message });
  }
});

// Create Stripe Customer Portal session (for managing subscription)
router.post('/portal', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado a esta cuenta' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { stripeCustomerId: true },
    });

    if (!client?.stripeCustomerId) {
      return res.status(400).json({ error: 'No hay suscripción activa' });
    }

    const s = await getStripeClient();
    const session = await s.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: `${getAdminOrigin(req)}/dashboard/billing`,
    });

    res.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al abrir portal';
    res.status(500).json({ error: message });
  }
});

// Stripe Webhook (must use raw body)
router.post('/webhook', async (req, res) => {
  try {
    const s = await getStripeClient();
    const webhookSecret = await getStripeWebhookSecret();

    let event: Stripe.Event;

    if (webhookSecret) {
      const sig = req.headers['stripe-signature'] as string;
      event = s.webhooks.constructEvent((req as unknown as { rawBody: Buffer }).rawBody, sig, webhookSecret);
    } else {
      event = req.body as Stripe.Event;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clientId = session.metadata?.clientId;
        const plan = session.metadata?.plan;

        if (clientId && plan && plan !== 'FREE') {
          await prisma.client.update({
            where: { id: clientId },
            data: {
              plan,
              stripeSubscriptionId: session.subscription as string,
            },
          });
          console.log(`[Stripe] Client ${clientId} upgraded to ${plan}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await s.customers.retrieve(subscription.customer as string);
        const clientId = (customer as Stripe.Customer).metadata?.clientId;

        if (clientId) {
          let plan: 'FREE' | 'BASIC' | 'PRO' = 'FREE';
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            const priceId = subscription.items.data[0]?.price?.id;
            if (priceId) {
              plan = await getPlanForPriceId(priceId);
            }
          }

          await prisma.client.update({
            where: { id: clientId },
            data: {
              plan,
              stripeSubscriptionId: subscription.id,
            },
          });
          console.log(`[Stripe] Subscription updated for ${clientId}: ${plan}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await s.customers.retrieve(subscription.customer as string);
        const clientId = (customer as Stripe.Customer).metadata?.clientId;

        if (clientId) {
          await prisma.client.update({
            where: { id: clientId },
            data: { plan: 'FREE', stripeSubscriptionId: null },
          });
          console.log(`[Stripe] Subscription cancelled for ${clientId}, downgraded to FREE`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customer = await s.customers.retrieve(invoice.customer as string);
        const clientId = (customer as Stripe.Customer).metadata?.clientId;
        if (clientId) {
          console.log(`[Stripe] Payment failed for ${clientId}`);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    console.error('[Stripe Webhook] Error:', message);
    res.status(400).json({ error: message });
  }
});

export default router;
