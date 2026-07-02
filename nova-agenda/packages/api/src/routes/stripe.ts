import { Router, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getClientPlanUsage } from '../middleware/plan-limits';

const router = Router();
const prisma = new PrismaClient();

// Lazy-init Stripe client
let stripe: Stripe | null = null;

async function getStripe(): Promise<Stripe> {
  if (stripe) return stripe;

  const configs = await prisma.platformConfig.findMany({
    where: { key: { in: ['stripe_secret_key'] } },
  });
  const secretKey = configs.find(c => c.key === 'stripe_secret_key')?.value;

  if (!secretKey) {
    throw new Error('Stripe Secret Key no configurada. Ve a Configuración > Stripe.');
  }

  stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
  return stripe;
}

async function getPriceId(): Promise<string> {
  const config = await prisma.platformConfig.findUnique({ where: { key: 'stripe_price_id' } });
  if (!config?.value) {
    throw new Error('Stripe Price ID no configurado. Ve a Configuración > Stripe.');
  }
  return config.value;
}

// Plan definitions with prices
const PLANS: Record<string, { name: string; price: number; features: string[] }> = {
  FREE: { name: 'Gratuito', price: 0, features: ['Agenda de citas', 'Hasta 3 servicios', 'Hasta 50 citas/mes'] },
  BASIC: { name: 'Profesional', price: 49, features: ['Todo del plan Gratuito', 'Página web personalizada', 'Dominio propio', 'Recordatorios SMS'] },
  PRO: { name: 'Business', price: 99, features: ['Todo del plan Profesional', 'WhatsApp con IA integrada', 'Chatbot 24/7', 'Servicios ilimitados'] },
};

// Get available plans + current subscription info
router.get('/plans', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { plan: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });

    if (!client) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    let subscription: any = null;
    if (client.stripeSubscriptionId) {
      try {
        const s = await (await getStripe()).subscriptions.retrieve(client.stripeSubscriptionId);
        subscription = {
          id: s.id,
          status: s.status,
          currentPeriodEnd: new Date((s as any).current_period_end * 1000).toISOString(),
          cancelAt: s.cancel_at ? new Date(s.cancel_at * 1000).toISOString() : null,
        };
      } catch {
        // Subscription may not exist in Stripe yet (test mode)
      }
    }

    res.json({
      currentPlan: client.plan,
      plans: PLANS,
      subscription,
      usage: await getClientPlanUsage(clientId, client.plan),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Stripe Checkout Session for subscription upgrade
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    const { plan } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado' });
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

    const s = await getStripe();
    const priceId = await getPriceId();

    // Create or retrieve Stripe customer
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

    // Create checkout session
    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { clientId: client.id, plan },
      success_url: `${req.headers.origin || 'http://localhost:3002'}/dashboard/billing?success=true`,
      cancel_url: `${req.headers.origin || 'http://localhost:3002'}/dashboard/billing?canceled=true`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Stripe Customer Portal session (for managing subscription)
router.post('/portal', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { stripeCustomerId: true },
    });

    if (!client?.stripeCustomerId) {
      return res.status(400).json({ error: 'No hay suscripción activa' });
    }

    const s = await getStripe();
    const session = await s.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: `${req.headers.origin || 'http://localhost:3002'}/dashboard/billing`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook (must use raw body)
router.post('/webhook', async (req, res) => {
  try {
    const s = await getStripe();

    const configs = await prisma.platformConfig.findMany({
      where: { key: { in: ['stripe_webhook_secret'] } },
    });
    const webhookSecret = configs.find(c => c.key === 'stripe_webhook_secret')?.value;

    let event: Stripe.Event;

    if (webhookSecret) {
      const sig = req.headers['stripe-signature'] as string;
      event = s.webhooks.constructEvent((req as any).rawBody, sig, webhookSecret);
    } else {
      event = req.body as Stripe.Event;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clientId = session.metadata?.clientId;
        const plan = session.metadata?.plan;

        if (clientId && plan) {
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
          // Determine plan from subscription status
          let plan = 'FREE';
          if (subscription.status === 'active') {
            // Check price to determine plan level
            const priceId = subscription.items.data[0]?.price?.id;
            const priceConfig = await prisma.platformConfig.findUnique({ where: { key: 'stripe_price_id' } });
            plan = priceId === priceConfig?.value ? 'BASIC' : 'BASIC';
          }

          await prisma.client.update({
            where: { id: clientId },
            data: { plan },
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
          // Optionally: send notification, downgrade after grace period
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
