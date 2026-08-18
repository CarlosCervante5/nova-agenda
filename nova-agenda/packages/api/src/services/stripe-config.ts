import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLAN_PRICE_KEYS: Record<string, string[]> = {
  PRO: ['stripe_price_id_pro', 'stripe_price_id'],
  CUSTOM: ['stripe_price_id_custom'],
};

const ENV_PRICE_KEYS: Record<string, string[]> = {
  PRO: ['STRIPE_PRICE_ID_PRO', 'STRIPE_PRICE_ID'],
  CUSTOM: ['STRIPE_PRICE_ID_CUSTOM'],
};

/** Price IDs de producción (Stripe) — se usan si no hay env ni platform_config */
const PRODUCTION_PRICE_IDS: Record<string, string> = {
  PRO: 'price_1TpIa5Cu5CVszYevMhC70wqE',
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

  const priceId =
    (await getConfigValue(envKeys || [], dbKeys)) || PRODUCTION_PRICE_IDS[plan] || null;

  if (!priceId) {
    const label = plan === 'PRO' ? 'PRO ($149)' : 'Personalizado';
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

export async function getPlanForPriceId(priceId: string): Promise<'PRO' | 'CUSTOM' | 'FREE'> {
  const proPrice =
    (await getConfigValue(['STRIPE_PRICE_ID_PRO', 'STRIPE_PRICE_ID'], ['stripe_price_id_pro', 'stripe_price_id'])) ||
    PRODUCTION_PRICE_IDS.PRO;
  if (proPrice && priceId === proPrice) return 'PRO';

  const customPrice =
    await getConfigValue(['STRIPE_PRICE_ID_CUSTOM'], ['stripe_price_id_custom']);
  if (customPrice && priceId === customPrice) return 'CUSTOM';

  return 'FREE';
}

export async function isStripeConfigured(): Promise<{
  configured: boolean;
  hasSecretKey: boolean;
  hasProPrice: boolean;
  hasCustomPrice: boolean;
  missing: string[];
}> {
  const secretKey = await getConfigValue(['STRIPE_SECRET_KEY'], ['stripe_secret_key']);
  const proPrice =
    (await getConfigValue(['STRIPE_PRICE_ID_PRO', 'STRIPE_PRICE_ID'], ['stripe_price_id_pro', 'stripe_price_id'])) ||
    PRODUCTION_PRICE_IDS.PRO;
  const customPrice =
    await getConfigValue(['STRIPE_PRICE_ID_CUSTOM'], ['stripe_price_id_custom']);

  const missing: string[] = [];
  if (!secretKey) missing.push('STRIPE_SECRET_KEY / stripe_secret_key');

  return {
    configured: Boolean(secretKey),
    hasSecretKey: Boolean(secretKey),
    hasProPrice: Boolean(proPrice),
    hasCustomPrice: Boolean(customPrice),
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

export interface ClientStripeConfig {
  mode: 'test' | 'live';
  secretKey: string | null;
  publishableKey: string | null;
  webhookSecret: string | null;
}

export function getStripeModeFromKey(secretKey: string | null): 'test' | 'live' | null {
  if (!secretKey) return null;
  return secretKey.startsWith('sk_test_') ? 'test' : 'live';
}

/** Cuenta Stripe propia del negocio (para cobrar a sus clientes finales). */
export async function getClientStripeConfig(clientId: string): Promise<ClientStripeConfig> {
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

  const mode: 'test' | 'live' = client?.stripeMode === 'live' ? 'live' : 'test';
  const testKeys = mode === 'test';
  const secretKey = (testKeys ? client?.stripeTestSecretKey : client?.stripeLiveSecretKey)?.trim() || null;
  const publishableKey = (testKeys ? client?.stripeTestPublishableKey : client?.stripeLivePublishableKey)?.trim() || null;
  const webhookSecret = (testKeys ? client?.stripeTestWebhookSecret : client?.stripeLiveWebhookSecret)?.trim() || null;

  return { mode, secretKey, publishableKey, webhookSecret };
}

/** Client de Stripe de la cuenta del negocio. Fallback a la cuenta de la plataforma. */
export async function getClientStripeClient(clientId: string): Promise<Stripe> {
  const { secretKey } = await getClientStripeConfig(clientId);
  if (secretKey) {
    return new Stripe(secretKey);
  }
  return getStripeClient();
}

export function formatStripeError(error: unknown): string {  if (!error || typeof error !== 'object') {
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
