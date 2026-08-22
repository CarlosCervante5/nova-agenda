import dotenv from 'dotenv';
dotenv.config();

// Parse CORS origins from env, default to allowing all localhost ports + subdomains
const defaultOrigins = [
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  // Allow subdomains like demo.localhost:3002
  /^https?:\/\/.*\.localhost:\d+$/,
];

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && (!secret || secret === 'dev-secret' || secret.length < 32)) {
    throw new Error('JWT_SECRET es obligatorio en producción (mínimo 32 caracteres).');
  }

  if (!secret || secret === 'dev-secret') {
    console.warn('[config] JWT_SECRET no definido — usando secreto de desarrollo. No uses esto en producción.');
    return 'dev-secret';
  }

  return secret;
}

export const config = {
  port: parseInt(process.env.PORT || process.env.API_PORT || '3001', 10),
  jwtSecret: resolveJwtSecret(),
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || defaultOrigins,
  baseDomain: process.env.MULTI_TENANT_BASE_DOMAIN || 'localhost',
};
