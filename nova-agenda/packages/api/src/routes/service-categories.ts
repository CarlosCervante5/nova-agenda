import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getPlanLevel } from '../middleware/plan-check';

const router = Router();
const prisma = new PrismaClient();

function canAccessClient(req: AuthRequest, clientId: string) {
  return req.user!.role === 'SUPER_ADMIN' || req.user!.clientId === clientId;
}

async function assertCategoriesPlan(clientId: string, res: Response) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { plan: true },
  });
  if (!client) {
    res.status(404).json({ error: 'Negocio no encontrado' });
    return null;
  }
  if (getPlanLevel(client.plan) < getPlanLevel('BASIC')) {
    res.status(403).json({
      error: 'Las categorías de servicios requieren el plan Profesional o superior.',
      code: 'PLAN_UPGRADE_REQUIRED',
      currentPlan: client.plan,
      requiredPlan: 'BASIC',
    });
    return null;
  }
  return client;
}

const categoryInclude = {
  children: {
    orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
    include: {
      _count: { select: { services: true } },
    },
  },
  _count: { select: { services: true, children: true } },
};

// List categories (tree: roots with children)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId =
      req.user!.role === 'SUPER_ADMIN'
        ? (req.query.clientId as string) || req.user!.clientId
        : req.user!.clientId;

    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado' });
    }
    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertCategoriesPlan(clientId, res))) return;

    const categories = await prisma.serviceCategory.findMany({
      where: { clientId, parentId: null },
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    res.json(categories);
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Flat list (all categories for dropdowns)
router.get('/flat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId =
      req.user!.role === 'SUPER_ADMIN'
        ? (req.query.clientId as string) || req.user!.clientId
        : req.user!.clientId;

    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado' });
    }
    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertCategoriesPlan(clientId, res))) return;

    const categories = await prisma.serviceCategory.findMany({
      where: { clientId },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { services: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create category
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clientId =
      req.user!.role === 'SUPER_ADMIN'
        ? req.body.clientId || req.user!.clientId
        : req.user!.clientId;

    if (!clientId) {
      return res.status(400).json({ error: 'No hay negocio asociado' });
    }
    if (!canAccessClient(req, clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertCategoriesPlan(clientId, res))) return;

    const { name, description, color, sortOrder, parentId, isActive } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    if (parentId) {
      const parent = await prisma.serviceCategory.findFirst({
        where: { id: parentId, clientId },
        include: { parent: true },
      });
      if (!parent) {
        return res.status(400).json({ error: 'Categoría padre no encontrada' });
      }
      // Máximo 2 niveles: no permitir nietos
      if (parent.parentId) {
        return res.status(400).json({
          error: 'Solo se permiten dos niveles: categoría y subcategoría.',
        });
      }
    }

    const category = await prisma.serviceCategory.create({
      data: {
        clientId,
        name: name.trim(),
        description: description || null,
        color: color || '#2dd4bf',
        sortOrder: Number(sortOrder) || 0,
        parentId: parentId || null,
        isActive: isActive !== false,
      },
      include: categoryInclude,
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    if (!canAccessClient(req, existing.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertCategoriesPlan(existing.clientId, res))) return;

    const { name, description, color, sortOrder, parentId, isActive } = req.body;

    if (parentId !== undefined) {
      if (parentId === id) {
        return res.status(400).json({ error: 'Una categoría no puede ser padre de sí misma' });
      }
      if (parentId) {
        const parent = await prisma.serviceCategory.findFirst({
          where: { id: parentId, clientId: existing.clientId },
          include: { parent: true },
        });
        if (!parent) {
          return res.status(400).json({ error: 'Categoría padre no encontrada' });
        }
        if (parent.parentId) {
          return res.status(400).json({
            error: 'Solo se permiten dos niveles: categoría y subcategoría.',
          });
        }
        // No mover una categoría con hijos bajo otra (evitar 3 niveles)
        const childCount = await prisma.serviceCategory.count({ where: { parentId: id } });
        if (childCount > 0) {
          return res.status(400).json({
            error: 'No puedes anidar una categoría que ya tiene subcategorías.',
          });
        }
      }
    }

    const category = await prisma.serviceCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(color !== undefined && { color }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(typeof isActive === 'boolean' && { isActive }),
      },
      include: categoryInclude,
    });

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category (services quedan sin categoría)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    if (!canAccessClient(req, existing.clientId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!(await assertCategoriesPlan(existing.clientId, res))) return;

    await prisma.serviceCategory.delete({ where: { id } });
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
