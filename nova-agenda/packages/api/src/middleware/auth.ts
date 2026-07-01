import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    clientId?: string;
  };
}

export interface TenantRequest extends Request {
  client?: {
    id: string;
    name: string;
    slug: string;
    primaryColor: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

export async function resolveTenant(req: TenantRequest, res: Response, next: NextFunction) {
  // Extract subdomain from host
  const host = req.headers.host || '';
  const parts = host.split('.');
  
  if (parts.length < 3 && config.baseDomain === 'localhost') {
    // For localhost, try to get slug from query or header
    const slug = req.query.tenant as string || req.headers['x-tenant-id'] as string;
    
    if (slug) {
      const client = await prisma.client.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true, primaryColor: true, isActive: true },
      });

      if (client && client.isActive) {
        req.client = client;
        return next();
      }
    }
    
    return next(); // No tenant context, that's OK for some routes
  }

  const subdomain = parts[0];
  
  // Skip common subdomains
  if (['www', 'api', 'admin', 'mail'].includes(subdomain)) {
    return next();
  }

  const client = await prisma.client.findUnique({
    where: { slug: subdomain },
    select: { id: true, name: true, slug: true, primaryColor: true, isActive: true },
  });

  if (client && client.isActive) {
    req.client = client;
  }

  next();
}
