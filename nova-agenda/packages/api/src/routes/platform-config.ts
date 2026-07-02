import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Platform config keys organized by category
const CONFIG_SCHEMA: Record<string, Array<{ key: string; label: string; type: string }>> = {
  stripe: [
    { key: 'stripe_secret_key', label: 'Secret Key', type: 'password' },
    { key: 'stripe_publishable_key', label: 'Publishable Key', type: 'text' },
    { key: 'stripe_webhook_secret', label: 'Webhook Secret', type: 'password' },
    { key: 'stripe_price_id_basic', label: 'Price ID — Plan Profesional ($49)', type: 'text' },
    { key: 'stripe_price_id_pro', label: 'Price ID — Plan Business ($99)', type: 'text' },
    { key: 'stripe_price_id', label: 'Price ID (legacy / fallback BASIC)', type: 'text' },
  ],
  evo_cloud: [
    { key: 'evo_cloud_api_url', label: 'API URL', type: 'text' },
    { key: 'evo_cloud_api_key', label: 'API Key', type: 'password' },
    { key: 'evo_cloud_instance_id', label: 'Instance ID', type: 'text' },
  ],
  openai: [
    { key: 'openai_api_key', label: 'API Key', type: 'password' },
    { key: 'openai_model', label: 'Modelo', type: 'text' },
    { key: 'openai_max_tokens', label: 'Max Tokens', type: 'number' },
  ],
};

// Get all platform configs (grouped by category)
router.get('/', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const configs = await prisma.platformConfig.findMany();
    const configMap: Record<string, string> = {};
    configs.forEach(c => { configMap[c.key] = c.value; });

    res.json({
      stripe: {
        stripe_secret_key: configMap['stripe_secret_key'] || '',
        stripe_publishable_key: configMap['stripe_publishable_key'] || '',
        stripe_webhook_secret: configMap['stripe_webhook_secret'] || '',
        stripe_price_id_basic: configMap['stripe_price_id_basic'] || configMap['stripe_price_id'] || '',
        stripe_price_id_pro: configMap['stripe_price_id_pro'] || '',
        stripe_price_id: configMap['stripe_price_id'] || '',
      },
      evo_cloud: {
        evo_cloud_api_url: configMap['evo_cloud_api_url'] || 'https://api.evo.cloud',
        evo_cloud_api_key: configMap['evo_cloud_api_key'] || '',
        evo_cloud_instance_id: configMap['evo_cloud_instance_id'] || '',
      },
      openai: {
        openai_api_key: configMap['openai_api_key'] || '',
        openai_model: configMap['openai_model'] || 'gpt-4o',
        openai_max_tokens: configMap['openai_max_tokens'] || '500',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get configs by category
router.get('/:category', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { category } = req.params;
    const schema = CONFIG_SCHEMA[category];
    if (!schema) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const keys = schema.map(s => s.key);
    const configs = await prisma.platformConfig.findMany({
      where: { key: { in: keys } },
    });

    const result: Record<string, string> = {};
    configs.forEach(c => { result[c.key] = c.value; });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update configs by category
router.put('/:category', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { category } = req.params;
    const schema = CONFIG_SCHEMA[category];
    if (!schema) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const updates = req.body;
    const upserts = Object.entries(updates).map(([key, value]) =>
      prisma.platformConfig.upsert({
        where: { key },
        update: { value: String(value), category },
        create: { key, value: String(value), category, label: schema.find(s => s.key === key)?.label || key },
      })
    );

    await Promise.all(upserts);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a config
router.delete('/:key', authenticate, authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { key } = req.params;
    await prisma.platformConfig.delete({ where: { key } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
