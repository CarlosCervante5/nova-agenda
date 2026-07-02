import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLAN_PRICE_KEYS: Record<string, string[]> = {
  BASIC: ['stripe_price_id_basic', 'stripe_price_id'],
  PRO: ['stripe_price_id_pro'],
};

const ENV_PRICE_KEYS: Record<string, string[]> = {
  BASIC: ['STRIPE_PRICE_ID_BASIC', 'STRIPE_PRICE_ID'],
  PRO: ['STRIPE_PRICE_ID_PRO'],
};

async function getConfigValue(keys: string[]): Promise<string | null> {
  for (const key of keys) {
    const envVal = process.env[key];
    if (envVal) return envVal;
  }

  const dbKeys = keys.filter((k) => k === k.toLowerCase());
  if (dbKeys.length === 0) return null;

  const configs = await prisma.platformConfig.findMany({
    where: { key: { in: dbKeys } },
  });

  for (const key of dbKeys) {
    const found = configs.find((c) => c.key === key);
    if (found?.value) return found.value;
  }

  return null;
}

export async function getStripeSecretKey(): Promise<string> {
  const key =
    process.env.STRIPE_SECRET_KEY ||
    (await getConfigValue(['stripe_secret_key']));

  if (!key) {
    throw new Error(
      'Stripe no está configurado. Agrega STRIPE_SECRET_KEY en la API o ve a Configuración > Stripe.'
    );
  }

  return key;
}

export async function getStripeWebhookSecret(): Promise<string | null> {
  return (
    process.env.STRIPE_WEBHOOK_SECRET ||
    (await getConfigValue(['stripe_webhook_secret']))
  );
}

export async function getPriceIdForPlan(plan: string): Promise<string> {
  const dbKeys = PLAN_PRICE_KEYS[plan];
  const envKeys = ENV_PRICE_KEYS[plan];

  if (!dbKeys) {
    throw new Error('Plan inválido');
  }

  for (const key of envKeys || []) {
    if (process.env[key]) return process.env[key]!;
  }

  const priceId = await getConfigValue(dbKeys);

  if (!priceId) {
    const label = plan === 'PRO' ? 'Business ($99)' : 'Profesional ($49)';
    throw new Error(
      `Price ID no configurado para ${label}. Usa stripe_price_id_${plan.toLowerCase()} o STRIPE_PRICE_ID_${plan}.`
    );
  }

  return priceId;
}

export async function getPlanForPriceId(priceId: string): Promise<'BASIC' | 'PRO' | 'FREE'> {
  const proPrice = process.env.STRIPE_PRICE_ID_PRO || (await getConfigValue(['stripe_price_id_pro']));
  if (proPrice && priceId === proPrice) return 'PRO';

  const basicPrice =
    process.env.STRIPE_PRICE_ID_BASIC ||
    process.env.STRIPE_PRICE_ID ||
    (await getConfigValue(['stripe_price_id_basic', 'stripe_price_id']));
  if (basicPrice && priceId === basicPrice) return 'BASIC';

  return 'FREE';
}

let stripe: Stripe | null = null;

export async function getStripeClient(): Promise<Stripe> {
  if (stripe) return stripe;
  stripe = new Stripe(await getStripeSecretKey(), {
    apiVersion: '2024-12-18.acacia' as any,
  });
  return stripe;
}

export function resetStripeClient() {
  stripe = null;
}
