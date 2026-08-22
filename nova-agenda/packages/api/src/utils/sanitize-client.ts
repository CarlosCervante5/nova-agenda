/** Columnas de credenciales Stripe. Nunca deben salir en GET/PUT de /api/clients. */
export const CLIENT_SECRET_KEYS = [
  'stripeTestSecretKey',
  'stripeTestPublishableKey',
  'stripeTestWebhookSecret',
  'stripeLiveSecretKey',
  'stripeLivePublishableKey',
  'stripeLiveWebhookSecret',
] as const;

export type ClientSecretKey = (typeof CLIENT_SECRET_KEYS)[number];

export function sanitizeClient<T extends object>(client: T): Omit<T, ClientSecretKey> {
  const copy = { ...client } as T & Record<string, unknown>;
  for (const key of CLIENT_SECRET_KEYS) {
    delete copy[key];
  }
  return copy;
}

export function sanitizeClients<T extends object>(clients: T[]) {
  return clients.map((c) => sanitizeClient(c));
}
