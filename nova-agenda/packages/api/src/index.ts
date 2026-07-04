import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import serviceRoutes from './routes/services';
import bookingRoutes from './routes/bookings';
import publicRoutes from './routes/public';
import whatsappRoutes from './routes/whatsapp';
import platformConfigRoutes from './routes/platform-config';
import stripeRoutes from './routes/stripe';
import loyaltyRoutes from './routes/loyalty';
import staffRoutes from './routes/staff';
import serviceCategoryRoutes from './routes/service-categories';
import { whatsappHandler } from './services/whatsapp-handler';

const app = express();

// Health check (before middleware — Railway probes this path)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CORS: allow all localhost origins including subdomains (e.g., demo.localhost:3002)
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow any localhost origin (with or without subdomain)
    if (/^https?:\/\/(.*\.)?localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Check explicit whitelist
    const allowedOrigins = config.corsOrigin as string[];
    if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Stripe webhook needs raw body; no aplicar express.json() a esa ruta
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/stripe/webhook')) return next();
  return express.json()(req, res, next);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/service-categories', serviceCategoryRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/platform-config', platformConfigRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/staff', staffRoutes);

// Start server — bind 0.0.0.0 for Railway/Docker
const host = '0.0.0.0';
app.listen(config.port, host, () => {
  console.log(`🚀 API server running on http://${host}:${config.port}`);

  // Start WhatsApp reminder scheduler
  whatsappHandler.startReminderScheduler();
});

process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled rejection:', reason);
  process.exit(1);
});
