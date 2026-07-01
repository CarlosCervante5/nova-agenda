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

export const config = {
  port: parseInt(process.env.PORT || process.env.API_PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || defaultOrigins,
  baseDomain: process.env.MULTI_TENANT_BASE_DOMAIN || 'localhost',
};
