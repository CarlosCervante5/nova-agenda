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
import { whatsappHandler } from './services/whatsapp-handler';

const app = express();

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

// Stripe webhook needs raw body BEFORE express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/platform-config', platformConfigRoutes);
app.use('/api/stripe', stripeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(config.port, () => {
  console.log(`🚀 API server running on http://localhost:${config.port}`);
  
  // Start WhatsApp reminder scheduler
  whatsappHandler.startReminderScheduler();
});
