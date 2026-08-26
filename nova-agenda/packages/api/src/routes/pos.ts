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

function digits(phone?: string | null) {
  return (phone || '').replace(/\D/g, '');
}

function customerKey(name?: string | null, phone?: string | null) {
  const p = digits(phone);
  if (p) return `p:${p}`;
  return `n:${(name || '').trim().toLowerCase()}`;
}

type PaymentSplit = { method: string; amount: number };

function parseSplits(raw: unknown): PaymentSplit[] {
  let value = raw;
  if (typeof raw === 'string' && raw.trim()) {
    try { value = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      method: String((row as PaymentSplit)?.method || ''),
      amount: money((row as PaymentSplit)?.amount),
    }))
    .filter((row) => (METHODS as readonly string[]).includes(row.method) && row.amount > 0);
}

function serializeSale<T extends { paymentSplits?: string | null }>(sale: T) {
  return { ...sale, paymentSplits: parseSplits(sale.paymentSplits) };
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
    select: { total: true, paymentMethod: true, paymentSplits: true },
  });

  const byMethod: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0 };
  let todayTotal = 0;
  for (const sale of sales) {
    todayTotal += sale.total;
    const splits = parseSplits(sale.paymentSplits);
    if (splits.length > 0) {
      for (const split of splits) {
        byMethod[split.method] = (byMethod[split.method] || 0) + split.amount;
      }
    } else {
      byMethod[sale.paymentMethod] = (byMethod[sale.paymentMethod] || 0) + sale.total;
    }
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
  res.json(sales.map(serializeSale));
});

router.get('/customers', async (req: AuthRequest, res: Response) => {
  const clientId = await requirePos(req, res, resolveClientId(req, req.query.clientId as string));
  if (!clientId) return;

  const [saved, bookings, sales, cards] = await Promise.all([
    prisma.posCustomer.findMany({ where: { clientId }, orderBy: { name: 'asc' } }),
    prisma.booking.findMany({
      where: { clientId },
      select: { customerName: true, customerPhone: true, customerEmail: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.posSale.findMany({
      where: { clientId, status: 'COMPLETED' },
      select: { customerName: true, customerPhone: true },
      take: 500,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.loyaltyCard.findMany({
      where: { program: { clientId } },
      select: { customerName: true, customerPhone: true, customerEmail: true },
      take: 500,
    }),
  ]);

  const map = new Map<string, { id: string; name: string; phone: string | null; email: string | null }>();
  for (const c of saved) {
    map.set(customerKey(c.name, c.phone) || c.id, {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
    });
  }
  const extras = [
    ...bookings.map((b) => ({ name: b.customerName, phone: b.customerPhone, email: b.customerEmail })),
    ...sales.map((s) => ({ name: s.customerName, phone: s.customerPhone, email: null as string | null })),
    ...cards.map((c) => ({ name: c.customerName, phone: c.customerPhone, email: c.customerEmail })),
  ];
  for (const row of extras) {
    if (!row.name?.trim() && !row.phone) continue;
    const key = customerKey(row.name, row.phone);
    if (!key || key === 'n:' || map.has(key)) continue;
    map.set(key, {
      id: `ext-${key}`,
      name: (row.name || '').trim() || 'Cliente',
      phone: row.phone || null,
      email: row.email || null,
    });
  }

  res.json(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es')));
});

router.post('/customers', async (req: AuthRequest, res: Response) => {
  const clientId = await requirePos(req, res, resolveClientId(req, req.body.clientId));
  if (!clientId) return;

  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim() || null;
  const email = String(req.body.email || '').trim() || null;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  if (phone) {
    const existing = await prisma.posCustomer.findFirst({ where: { clientId, phone } });
    if (existing) {
      const updated = await prisma.posCustomer.update({
        where: { id: existing.id },
        data: { name, email: email || existing.email },
      });
      return res.json(updated);
    }
  }

  const customer = await prisma.posCustomer.create({
    data: { clientId, name, phone, email },
  });
  res.status(201).json(customer);
});

router.post('/sales', async (req: AuthRequest, res: Response) => {
  const clientId = await requirePos(req, res, resolveClientId(req, req.body.clientId));
  if (!clientId) return;

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'Agrega al menos un artículo' });

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
  const percentRaw = Number(req.body.discountPercent);
  const discountPercent = Number.isFinite(percentRaw) ? Math.min(100, Math.max(0, percentRaw)) : 0;
  const discount = discountPercent > 0
    ? money(subtotal * discountPercent / 100)
    : Math.min(subtotal, money(req.body.discount));
  const total = money(subtotal - discount);
  const receivedAmount = req.body.receivedAmount !== undefined ? money(req.body.receivedAmount) : null;

  let splits = parseSplits(req.body.payments ?? req.body.paymentSplits);
  if (splits.length === 0 && (METHODS as readonly string[]).includes(req.body.paymentMethod)) {
    splits = total > 0 ? [{ method: req.body.paymentMethod, amount: total }] : [];
  }
  const uniqueMethods = new Set(splits.map((s) => s.method));
  if (total > 0 && (splits.length === 0 || uniqueMethods.size !== splits.length)) {
    return res.status(400).json({ error: 'Indica al menos un método de pago válido' });
  }
  const paid = money(splits.reduce((sum, s) => sum + s.amount, 0));
  if (total > 0 && Math.abs(paid - total) > 0.05) {
    return res.status(400).json({ error: 'La suma de los pagos debe coincidir con el total' });
  }
  const method = splits.length <= 1 ? (splits[0]?.method || req.body.paymentMethod || 'CASH') : 'SPLIT';

  const sale = await prisma.posSale.create({
    data: {
      clientId,
      soldById: req.user!.id,
      customerName: req.body.customerName?.trim() || null,
      customerPhone: req.body.customerPhone?.trim() || null,
      subtotal,
      discount,
      discountPercent,
      total,
      paymentMethod: method,
      paymentSplits: splits.length ? JSON.stringify(splits) : null,
      status: 'COMPLETED',
      notes: req.body.notes?.trim() || null,
      receivedAmount,
      items: { create: normalized },
    },
    include: { items: true },
  });

  res.status(201).json(serializeSale(sale));
});

router.post('/sales/:id/void', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.posSale.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Venta no encontrada' });
  if (req.user!.role !== 'SUPER_ADMIN' && existing.clientId !== req.user!.clientId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const allowed = await requirePos(req, res, existing.clientId);
  if (!allowed) return;
  if (existing.status === 'VOIDED') return res.json(serializeSale(existing));

  const sale = await prisma.posSale.update({
    where: { id: existing.id },
    data: { status: 'VOIDED' },
    include: { items: true },
  });
  res.json(serializeSale(sale));
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
