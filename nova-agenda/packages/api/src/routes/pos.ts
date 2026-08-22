import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { assertHasAddon } from '../middleware/plan-limits';

const router = Router();
const prisma = new PrismaClient();

const METHODS = ['CASH', 'CARD', 'TRANSFER'] as const;
const KINDS = ['SERVICE', 'PRODUCT', 'CUSTOM'] as const;

function resolveClientId(req: AuthRequest, fallback?: string) {
  if (req.user!.role === 'SUPER_ADMIN') return fallback || req.user!.clientId || null;
  return req.user!.clientId || null;
}

async function requirePos(req: AuthRequest, res: Response, clientId: string | null) {
  if (!clientId) {
    res.status(400).json({ error: 'No hay negocio asociado' });
    return null;
  }
  const check = await assertHasAddon(clientId, 'POS');
  if (!check.ok) {
    res.status(check.status).json({ error: check.error, code: check.code });
    return null;
  }
  return clientId;
}

function money(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.round(v * 100) / 100;
}

router.use(authenticate);

router.get('/catalog', async (req: AuthRequest, res: Response) => {
  const clientId = await requirePos(req, res, resolveClientId(req, req.query.clientId as string));
  if (!clientId) return;

  const [services, products] = await Promise.all([
    prisma.service.findMany({
      where: { clientId, isActive: true },
      select: { id: true, name: true, price: true, duration: true, color: true },
      orderBy: { name: 'asc' },
    }),
    prisma.posProduct.findMany({
      where: { clientId, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  res.json({ services, products });
});

router.get('/summary', async (req: AuthRequest, res: Response) => {
  const clientId = await requirePos(req, res, resolveClientId(req, req.query.clientId as string));
  if (!clientId) return;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const sales = await prisma.posSale.findMany({
    where: { clientId, status: 'COMPLETED', createdAt: { gte: start, lte: end } },
    select: { total: true, paymentMethod: true },
  });

  const byMethod: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0 };
  let todayTotal = 0;
  for (const sale of sales) {
    todayTotal += sale.total;
    byMethod[sale.paymentMethod] = (byMethod[sale.paymentMethod] || 0) + sale.total;
  }

  res.json({ todayCount: sales.length, todayTotal: money(todayTotal), byMethod });
});

router.get('/products', async (req: AuthRequest, res: Response) => {
  const clientId = await requirePos(req, res, resolveClientId(req, req.query.clientId as string));
  if (!clientId) return;
  const products = await prisma.posProduct.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(products);
});

router.post('/products', async (req: AuthRequest, res: Response) => {
  const clientId = await requirePos(req, res, resolveClientId(req, req.body.clientId));
  if (!clientId) return;

  const name = String(req.body.name || '').trim();
  const price = money(req.body.price);
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const product = await prisma.posProduct.create({
    data: {
      clientId,
      name,
      description: req.body.description?.trim() || null,
      price,
      sku: req.body.sku?.trim() || null,
      isActive: req.body.isActive !== false,
    },
  });
  res.status(201).json(product);
});

router.put('/products/:id', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.posProduct.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  if (req.user!.role !== 'SUPER_ADMIN' && existing.clientId !== req.user!.clientId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const allowed = await requirePos(req, res, existing.clientId);
  if (!allowed) return;

  const product = await prisma.posProduct.update({
    where: { id: existing.id },
    data: {
      ...(req.body.name !== undefined && { name: String(req.body.name).trim() }),
      ...(req.body.description !== undefined && { description: req.body.description ? String(req.body.description).trim() : null }),
      ...(req.body.price !== undefined && { price: money(req.body.price) }),
      ...(req.body.sku !== undefined && { sku: req.body.sku ? String(req.body.sku).trim() : null }),
      ...(typeof req.body.isActive === 'boolean' && { isActive: req.body.isActive }),
    },
  });
  res.json(product);
});

router.delete('/products/:id', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.posProduct.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  if (req.user!.role !== 'SUPER_ADMIN' && existing.clientId !== req.user!.clientId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const allowed = await requirePos(req, res, existing.clientId);
  if (!allowed) return;
  await prisma.posProduct.update({ where: { id: existing.id }, data: { isActive: false } });
  res.json({ message: 'Producto desactivado' });
});

router.get('/sales', async (req: AuthRequest, res: Response) => {
  const clientId = await requirePos(req, res, resolveClientId(req, req.query.clientId as string));
  if (!clientId) return;

  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 14 * 86400000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const sales = await prisma.posSale.findMany({
    where: { clientId, createdAt: { gte: from, lte: to } },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(sales);
});

router.post('/sales', async (req: AuthRequest, res: Response) => {
  const clientId = await requirePos(req, res, resolveClientId(req, req.body.clientId));
  if (!clientId) return;

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'Agrega al menos un artículo' });

  const method = (METHODS as readonly string[]).includes(req.body.paymentMethod)
    ? req.body.paymentMethod
    : 'CASH';

  const normalized = items.map((item: Record<string, unknown>) => {
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
    const unitPrice = money(item.unitPrice);
    const kind = (KINDS as readonly string[]).includes(String(item.kind)) ? String(item.kind) : 'CUSTOM';
    return {
      kind,
      name: String(item.name || 'Artículo').trim().slice(0, 120),
      quantity,
      unitPrice,
      total: money(quantity * unitPrice),
      serviceId: kind === 'SERVICE' && typeof item.serviceId === 'string' ? item.serviceId : null,
      productId: kind === 'PRODUCT' && typeof item.productId === 'string' ? item.productId : null,
    };
  }).filter((item: { name: string }) => item.name);

  if (normalized.length === 0) return res.status(400).json({ error: 'Los artículos no son válidos' });

  const subtotal = money(normalized.reduce((sum: number, item: { total: number }) => sum + item.total, 0));
  const discount = Math.min(subtotal, money(req.body.discount));
  const total = money(subtotal - discount);
  const receivedAmount = req.body.receivedAmount !== undefined ? money(req.body.receivedAmount) : null;

  const sale = await prisma.posSale.create({
    data: {
      clientId,
      soldById: req.user!.id,
      customerName: req.body.customerName?.trim() || null,
      customerPhone: req.body.customerPhone?.trim() || null,
      subtotal,
      discount,
      total,
      paymentMethod: method,
      status: 'COMPLETED',
      notes: req.body.notes?.trim() || null,
      receivedAmount,
      items: { create: normalized },
    },
    include: { items: true },
  });

  res.status(201).json(sale);
});

router.post('/sales/:id/void', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.posSale.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Venta no encontrada' });
  if (req.user!.role !== 'SUPER_ADMIN' && existing.clientId !== req.user!.clientId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const allowed = await requirePos(req, res, existing.clientId);
  if (!allowed) return;
  if (existing.status === 'VOIDED') return res.json(existing);

  const sale = await prisma.posSale.update({
    where: { id: existing.id },
    data: { status: 'VOIDED' },
    include: { items: true },
  });
  res.json(sale);
});

router.get('/desktop/info', authenticate, (req: AuthRequest, res: Response) => {
  const slug = req.user!.clientId || 'unknown';
  res.json({
    slug,
    apiBase: req.protocol + '://' + req.get('host'),
    version: '1.0.0',
    downloadUrl: process.env.POS_DESKTOP_URL || null,
    instructions: 'Abre Nova Agenda POS, ingresa la dirección del admin y tu slug para conectar.',
  });
});

export default router;
