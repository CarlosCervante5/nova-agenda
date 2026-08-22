import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getClientStripeClient, getClientStripeConfig, formatStripeError } from '../services/stripe-config';

const router = Router();
const prisma = new PrismaClient();

const INTERVALS = ['month', 'year', 'one_time'] as const;
const CURRENCIES = ['mxn', 'usd'] as const;

function parseBenefits(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      return raw.split('\n').map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

function serializePlan<T extends { benefits: string }>(plan: T) {
  return { ...plan, benefits: parseBenefits(plan.benefits) };
}

function resolveClientId(req: AuthRequest, fallback?: string) {
  if (req.user!.role === 'SUPER_ADMIN') return fallback || req.user!.clientId || null;
  return req.user!.clientId || null;
}

function addInterval(from: Date, interval: string) {
  const d = new Date(from);
  if (interval === 'year') d.setFullYear(d.getFullYear() + 1);
  else if (interval === 'month') d.setMonth(d.getMonth() + 1);
  else return null;
  return d;
}

async function activateFromSession(clientId: string, session: Stripe.Checkout.Session, stripe: Stripe) {
  const purchaseId = session.metadata?.purchaseId;
  if (!purchaseId) return null;

  const paid = session.payment_status === 'paid' || session.status === 'complete';
  if (!paid && session.mode === 'subscription' && session.subscription) {
    // subscription checkout can be complete before first invoice settles
  } else if (!paid) {
    return null;
  }

  const purchase = await prisma.membershipPurchase.findUnique({
    where: { id: purchaseId },
    include: { plan: true },
  });
  if (!purchase || purchase.clientId !== clientId) return null;

  let periodEnd: Date | null = null;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id || null;

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    periodEnd = new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000);
  } else {
    periodEnd = addInterval(new Date(), purchase.plan.interval);
  }

  return prisma.membershipPurchase.update({
    where: { id: purchaseId },
    data: {
      status: 'ACTIVE',
      stripeCheckoutSessionId: session.id,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId:
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id || null,
      currentPeriodEnd: periodEnd,
    },
    include: { plan: { select: { name: true, interval: true, price: true, currency: true } } },
  });
}

// Public list
router.get('/public/:slug', async (req, res: Response) => {
  try {
    const client = await prisma.client.findUnique({
      where: { slug: req.params.slug, isActive: true },
      select: { id: true, name: true, slug: true, primaryColor: true },
    });
    if (!client) return res.status(404).json({ error: 'Negocio no encontrado' });

    const plans = await prisma.membershipPlan.findMany({
      where: { clientId: client.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });

    res.json({ client, plans: plans.map(serializePlan) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public checkout
router.post('/checkout', async (req, res: Response) => {
  try {
    const { clientSlug, planId, customerName, customerEmail, customerPhone, returnUrl } = req.body;
    if (!clientSlug || !planId || !customerName?.trim() || !customerEmail?.trim()) {
      return res.status(400).json({ error: 'Nombre, correo, negocio y membresía son obligatorios.' });
    }

    const client = await prisma.client.findUnique({ where: { slug: clientSlug, isActive: true } });
    if (!client) return res.status(404).json({ error: 'Negocio no encontrado' });

    const plan = await prisma.membershipPlan.findFirst({
      where: { id: planId, clientId: client.id, isActive: true },
    });
    if (!plan) return res.status(404).json({ error: 'Membresía no disponible' });

    const { secretKey } = await getClientStripeConfig(client.id);
    if (!secretKey) {
      return res.status(503).json({
        error: 'Este negocio aún no tiene Stripe configurado para cobrar membresías. Pídele que lo active en Configuración.',
      });
    }

    const stripe = await getClientStripeClient(client.id);
    const origin = String(returnUrl || req.headers.origin || '').replace(/\/$/, '');
    if (!origin) {
      return res.status(400).json({ error: 'No se pudo determinar la URL de retorno.' });
    }

    const purchase = await prisma.membershipPurchase.create({
      data: {
        clientId: client.id,
        planId: plan.id,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone?.trim() || null,
        status: 'PENDING',
      },
    });

    const unitAmount = Math.round(Number(plan.price) * 100);
    if (unitAmount < 1) {
      return res.status(400).json({ error: 'El precio de la membresía no es válido.' });
    }

    const recurring = plan.interval === 'year' || plan.interval === 'month'
      ? { interval: plan.interval as 'year' | 'month' }
      : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: recurring ? 'subscription' : 'payment',
      customer_email: customerEmail.trim(),
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency || 'mxn',
            unit_amount: unitAmount,
            product_data: {
              name: plan.name,
              description: plan.description || undefined,
            },
            ...(recurring ? { recurring } : {}),
          },
        },
      ],
      metadata: {
        clientId: client.id,
        planId: plan.id,
        purchaseId: purchase.id,
        type: 'membership',
      },
      ...(recurring
        ? {
            subscription_data: {
              metadata: {
                clientId: client.id,
                planId: plan.id,
                purchaseId: purchase.id,
                type: 'membership',
              },
            },
          }
        : {}),
      success_url: `${origin}?membership=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?membership=canceled`,
    });

    await prisma.membershipPurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    if (!session.url) {
      return res.status(502).json({ error: 'Stripe no devolvió URL de checkout' });
    }

    res.json({ url: session.url, sessionId: session.id });
  } catch (error: unknown) {
    console.error('[Membership checkout]', error);
    res.status(500).json({ error: formatStripeError(error) });
  }
});

// Confirm after redirect (no webhook required)
router.post('/confirm', async (req, res: Response) => {
  try {
    const { sessionId, clientSlug } = req.body;
    if (!sessionId || !clientSlug) {
      return res.status(400).json({ error: 'sessionId y clientSlug son obligatorios' });
    }

    const client = await prisma.client.findUnique({ where: { slug: clientSlug, isActive: true } });
    if (!client) return res.status(404).json({ error: 'Negocio no encontrado' });

    const stripe = await getClientStripeClient(client.id);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const purchase = await activateFromSession(client.id, session, stripe);
    if (!purchase) {
      return res.status(409).json({ error: 'El pago aún no está confirmado.' });
    }
    res.json(purchase);
  } catch (error: unknown) {
    res.status(500).json({ error: formatStripeError(error) });
  }
});

// Webhook for the business Stripe account
router.post('/webhook/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { webhookSecret } = await getClientStripeConfig(clientId);
    const stripe = await getClientStripeClient(clientId);

    const payload = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (!webhookSecret) {
      return res.status(503).json({ error: 'Webhook de Stripe del negocio no configurado' });
    }

    const sig = req.headers['stripe-signature'] as string;
    if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

    const event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === 'membership') {
        await activateFromSession(clientId, session, stripe);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const purchaseId = subscription.metadata?.purchaseId;
      if (purchaseId) {
        await prisma.membershipPurchase.updateMany({
          where: { id: purchaseId, clientId },
          data: { status: 'CANCELLED' },
        });
      }
    }

    res.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    console.error('[Membership webhook]', message);
    res.status(400).json({ error: message });
  }
});

// Admin: list plans
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = resolveClientId(req, req.query.clientId as string);
    if (!clientId) return res.status(400).json({ error: 'No hay negocio asociado' });

    const plans = await prisma.membershipPlan.findMany({
      where: { clientId },
      include: { _count: { select: { purchases: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(plans.map(serializePlan));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/purchases', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = resolveClientId(req, req.query.clientId as string);
    if (!clientId) return res.status(400).json({ error: 'No hay negocio asociado' });

    const purchases = await prisma.membershipPurchase.findMany({
      where: { clientId },
      include: { plan: { select: { name: true, interval: true, price: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(purchases);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId = resolveClientId(req, req.body.clientId);
    if (!clientId) return res.status(400).json({ error: 'No hay negocio asociado' });

    const { name, description, price, currency, interval, benefits, isActive, sortOrder } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'El precio no es válido' });
    }

    const plan = await prisma.membershipPlan.create({
      data: {
        clientId,
        name: name.trim(),
        description: description?.trim() || null,
        price: amount,
        currency: (CURRENCIES as readonly string[]).includes(currency) ? currency : 'mxn',
        interval: (INTERVALS as readonly string[]).includes(interval) ? interval : 'month',
        benefits: JSON.stringify(parseBenefits(benefits)),
        isActive: isActive !== false,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    res.status(201).json(serializePlan(plan));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.membershipPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Membresía no encontrada' });
    if (req.user!.role !== 'SUPER_ADMIN' && existing.clientId !== req.user!.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description, price, currency, interval, benefits, isActive, sortOrder } = req.body;
    const plan = await prisma.membershipPlan.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description ? String(description).trim() : null }),
        ...(price !== undefined && { price: Number(price) }),
        ...((CURRENCIES as readonly string[]).includes(currency) && { currency }),
        ...((INTERVALS as readonly string[]).includes(interval) && { interval }),
        ...(benefits !== undefined && { benefits: JSON.stringify(parseBenefits(benefits)) }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
      },
    });
    res.json(serializePlan(plan));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.membershipPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Membresía no encontrada' });
    if (req.user!.role !== 'SUPER_ADMIN' && existing.clientId !== req.user!.clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await prisma.membershipPlan.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    res.json({ message: 'Membresía desactivada' });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
