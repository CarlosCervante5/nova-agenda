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
  BASIC: { name: 'Profesional', price: 49, features: ['Todo del plan Gratuito', 'Página web personalizada', 'Personal para atender', 'Categorías de servicios', 'Hasta 20 servicios', 'Citas ilimitadas'] },
  PRO: { name: 'Business', price: 99, features: ['Todo del plan Profesional', 'WhatsApp con IA integrada', 'Chatbot 24/7', 'Servicios ilimitados'] },
};

function getAdminOrigin(req: AuthRequest): string {
  return (
    (req.headers.origin as string) ||
    process.env.ADMIN_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    ''
  );
}

async function applyPlanFromSubscription(
  clientId: string,
  subscription: Stripe.Subscription
): Promise<'FREE' | 'BASIC' | 'PRO'> {
  let plan: 'FREE' | 'BASIC' | 'PRO' = 'FREE';

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    const priceId = subscription.items.data[0]?.price?.id;
    const metaPlan = subscription.metadata?.plan;
    if (metaPlan === 'BASIC' || metaPlan === 'PRO') {
      plan = metaPlan;
    } else if (priceId) {
      plan = await getPlanForPriceId(priceId);
    }
  }

  await prisma.client.update({
    where: { id: clientId },
    data: {
      plan,
      stripeSubscriptionId: plan === 'FREE' ? null : subscription.id,
      stripeCustomerId: typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id,
    },
  });

  return plan;
}

async function syncClientFromStripe(clientId: string): Promise<{
  plan: string;
  subscription: Record<string, unknown> | null;
}> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { plan: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });

  if (!client?.stripeCustomerId) {
    return { plan: client?.plan || 'FREE', subscription: null };
  }

  const s = await getStripeClient();
  const subscriptions = await s.subscriptions.list({
    customer: client.stripeCustomerId,
    status: 'all',
    limit: 10,
  });

  const active = subscriptions.data.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );

  if (!active) {
    if (client.plan !== 'FREE' || client.stripeSubscriptionId) {
      await prisma.client.update({
        where: { id: clientId },
        data: { plan: 'FREE', stripeSubscriptionId: null },
      });
    }
    return { plan: 'FREE', subscription: null };
  }

  const plan = await applyPlanFromSubscription(clientId, active);

  return {
    plan,
    subscription: {
      id: active.id,
      status: active.status,
      currentPeriodEnd: new Date(
        (active as unknown as { current_period_end: number }).current_period_end * 1000
      ).toISOString(),
      cancelAt: active.cancel_at ? new Date(active.cancel_at * 1000).toISOString() : null,
    },
  };
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
      success_url: `${origin}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
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

// Sync plan from Stripe (fallback cuando el webhook no llegó)
router.post('/sync', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado a esta cuenta' });
    }

    const sessionId = req.body?.sessionId as string | undefined;
    const s = await getStripeClient();

    if (sessionId) {
      const session = await s.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });

      const metaClientId = session.metadata?.clientId;
      if (metaClientId && metaClientId !== clientId) {
        return res.status(403).json({ error: 'Sesión de pago no pertenece a este negocio' });
      }

      if (session.payment_status === 'paid' || session.status === 'complete') {
        const subscription =
          typeof session.subscription === 'string'
            ? await s.subscriptions.retrieve(session.subscription)
            : (session.subscription as Stripe.Subscription | null);

        if (subscription) {
          const planFromMeta = session.metadata?.plan;
          if (planFromMeta === 'BASIC' || planFromMeta === 'PRO') {
            subscription.metadata = { ...subscription.metadata, plan: planFromMeta };
          }
          const plan = await applyPlanFromSubscription(clientId, subscription);
          console.log(`[Stripe Sync] Client ${clientId} upgraded to ${plan} via session ${sessionId}`);
          return res.json({
            plan,
            subscription: {
              id: subscription.id,
              status: subscription.status,
              currentPeriodEnd: new Date(
                (subscription as unknown as { current_period_end: number }).current_period_end * 1000
              ).toISOString(),
              cancelAt: subscription.cancel_at
                ? new Date(subscription.cancel_at * 1000).toISOString()
                : null,
            },
          });
        }
      }
    }

    const result = await syncClientFromStripe(clientId);
    console.log(`[Stripe Sync] Client ${clientId} plan=${result.plan}`);
    res.json(result);
  } catch (error: unknown) {
    const message = formatStripeError(error);
    console.error('[Stripe Sync]', message, error);
    res.status(500).json({ error: message });
  }
});

// Stripe Webhook (body es Buffer por express.raw en index.ts)
router.post('/webhook', async (req, res) => {
  try {
    const s = await getStripeClient();
    const webhookSecret = await getStripeWebhookSecret();
    const payload = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    let event: Stripe.Event;

    if (webhookSecret) {
      const sig = req.headers['stripe-signature'] as string;
      if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }
      event = s.webhooks.constructEvent(payload, sig, webhookSecret);
    } else {
      event = JSON.parse(payload.toString('utf8')) as Stripe.Event;
      console.warn('[Stripe Webhook] Sin STRIPE_WEBHOOK_SECRET — firma no verificada');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clientId = session.metadata?.clientId;
        const planMeta = session.metadata?.plan;

        if (clientId && session.subscription) {
          const subscription =
            typeof session.subscription === 'string'
              ? await s.subscriptions.retrieve(session.subscription)
              : session.subscription;

          if (planMeta === 'BASIC' || planMeta === 'PRO') {
            subscription.metadata = { ...subscription.metadata, plan: planMeta };
          }

          const plan = await applyPlanFromSubscription(clientId, subscription);
          console.log(`[Stripe] Client ${clientId} upgraded to ${plan}`);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        let clientId = subscription.metadata?.clientId;

        if (!clientId) {
          const customer = await s.customers.retrieve(subscription.customer as string);
          clientId = (customer as Stripe.Customer).metadata?.clientId;
        }

        if (clientId) {
          const plan = await applyPlanFromSubscription(clientId, subscription);
          console.log(`[Stripe] Subscription ${event.type} for ${clientId}: ${plan}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        let clientId = subscription.metadata?.clientId;

        if (!clientId) {
          const customer = await s.customers.retrieve(subscription.customer as string);
          clientId = (customer as Stripe.Customer).metadata?.clientId;
        }

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
