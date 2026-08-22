import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: String(email), mode: 'insensitive' } },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const platformEmails = (process.env.PLATFORM_ADMIN_EMAILS || 'admin@novaagenda.com')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const sessionUser =
      platformEmails.includes(user.email.toLowerCase()) && (user.role !== 'SUPER_ADMIN' || user.clientId)
        ? await prisma.user.update({
            where: { id: user.id },
            data: { role: 'SUPER_ADMIN', clientId: null },
          })
        : user;

    const token = jwt.sign(
      {
        id: sessionUser.id,
        email: sessionUser.email,
        role: sessionUser.role,
        clientId: sessionUser.clientId,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role,
        clientId: sessionUser.clientId,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clientId: true,
        client: {
          select: { id: true, name: true, slug: true, primaryColor: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
