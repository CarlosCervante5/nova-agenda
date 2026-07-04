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

async function getDbConfigValue(keys: string[]): Promise<string | null> {
  const configs = await prisma.platformConfig.findMany({
    where: { key: { in: keys } },
  });

  for (const key of keys) {
    const found = configs.find((c) => c.key === key);
    const value = found?.value?.trim();
    if (value) return value;
  }

  return null;
}

async function getConfigValue(envKeys: string[], dbKeys: string[]): Promise<string | null> {
  for (const key of envKeys) {
    const envVal = process.env[key]?.trim();
    if (envVal) return envVal;
  }

  if (dbKeys.length === 0) return null;
  return getDbConfigValue(dbKeys);
}

export async function getStripeSecretKey(): Promise<string> {
  const key = await getConfigValue(['STRIPE_SECRET_KEY'], ['stripe_secret_key']);

  if (!key) {
    throw new Error(
      'Stripe no está configurado. Un SUPER_ADMIN debe ir a Configuración → Stripe o agregar STRIPE_SECRET_KEY en el servicio API de Railway.'
    );
  }

  if (!key.startsWith('sk_')) {
    throw new Error(
      'La clave secreta de Stripe no es válida. Debe empezar con sk_test_ o sk_live_.'
    );
  }

  return key;
}

export async function getStripeWebhookSecret(): Promise<string | null> {
  return getConfigValue(['STRIPE_WEBHOOK_SECRET'], ['stripe_webhook_secret']);
}

export async function getPriceIdForPlan(plan: string): Promise<string> {
  const dbKeys = PLAN_PRICE_KEYS[plan];
  const envKeys = ENV_PRICE_KEYS[plan];

  if (!dbKeys) {
    throw new Error('Plan inválido');
  }

  const priceId = await getConfigValue(envKeys || [], dbKeys);

  if (!priceId) {
    const label = plan === 'PRO' ? 'Business ($99)' : 'Profesional ($49)';
    throw new Error(
      `Price ID no configurado para el plan ${label}. Un SUPER_ADMIN debe ir a Configuración → Stripe y agregar stripe_price_id_${plan.toLowerCase()}, o definir STRIPE_PRICE_ID_${plan} en Railway.`
    );
  }

  if (!priceId.startsWith('price_')) {
    throw new Error(
      `El Price ID del plan ${plan} no es válido (debe empezar con price_). Revisa Configuración → Stripe.`
    );
  }

  return priceId;
}

export async function getPlanForPriceId(priceId: string): Promise<'BASIC' | 'PRO' | 'FREE'> {
  const proPrice = await getConfigValue(['STRIPE_PRICE_ID_PRO'], ['stripe_price_id_pro']);
  if (proPrice && priceId === proPrice) return 'PRO';

  const basicPrice = await getConfigValue(
    ['STRIPE_PRICE_ID_BASIC', 'STRIPE_PRICE_ID'],
    ['stripe_price_id_basic', 'stripe_price_id']
  );
  if (basicPrice && priceId === basicPrice) return 'BASIC';

  return 'FREE';
}

export async function isStripeConfigured(): Promise<{
  configured: boolean;
  hasSecretKey: boolean;
  hasBasicPrice: boolean;
  hasProPrice: boolean;
  missing: string[];
}> {
  const secretKey = await getConfigValue(['STRIPE_SECRET_KEY'], ['stripe_secret_key']);
  const basicPrice = await getConfigValue(
    ['STRIPE_PRICE_ID_BASIC', 'STRIPE_PRICE_ID'],
    ['stripe_price_id_basic', 'stripe_price_id']
  );
  const proPrice = await getConfigValue(['STRIPE_PRICE_ID_PRO'], ['stripe_price_id_pro']);

  const missing: string[] = [];
  if (!secretKey) missing.push('STRIPE_SECRET_KEY / stripe_secret_key');
  if (!basicPrice) missing.push('STRIPE_PRICE_ID_BASIC / stripe_price_id_basic');
  if (!proPrice) missing.push('STRIPE_PRICE_ID_PRO / stripe_price_id_pro');

  return {
    configured: Boolean(secretKey && basicPrice && proPrice),
    hasSecretKey: Boolean(secretKey),
    hasBasicPrice: Boolean(basicPrice),
    hasProPrice: Boolean(proPrice),
    missing,
  };
}

let stripe: Stripe | null = null;
let cachedSecretKey: string | null = null;

export async function getStripeClient(): Promise<Stripe> {
  const secretKey = await getStripeSecretKey();

  if (stripe && cachedSecretKey === secretKey) {
    return stripe;
  }

  stripe = new Stripe(secretKey);
  cachedSecretKey = secretKey;
  return stripe;
}

export function resetStripeClient() {
  stripe = null;
  cachedSecretKey = null;
}

export function formatStripeError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Error al procesar el pago con Stripe';
  }

  const err = error as {
    type?: string;
    code?: string;
    message?: string;
    raw?: { message?: string };
  };

  const message = err.message || err.raw?.message || '';

  if (message.includes('No such price')) {
    return 'El Price ID de Stripe no existe. Verifica en el Dashboard de Stripe que el price_... sea correcto y del mismo modo (test/live) que la clave secreta.';
  }

  if (message.includes('Invalid API Key') || message.includes('Invalid API key')) {
    return 'La clave secreta de Stripe no es válida. Revisa STRIPE_SECRET_KEY o Configuración → Stripe.';
  }

  if (err.type === 'StripeAuthenticationError') {
    return 'Autenticación con Stripe fallida. Revisa la clave secreta.';
  }

  if (message) return message;
  return 'Error al procesar el pago con Stripe';
}
