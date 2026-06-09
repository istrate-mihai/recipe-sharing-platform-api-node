// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

/**
 * Strict auth — 401 if no valid token
 */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) return res.status(401).json({ message: 'Unauthenticated.' });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }
}

/**
 * Optional auth — attaches user if token present, continues as guest if not.
 * Mirrors Laravel's auth()->shouldUse('sanctum') on public routes.
 */
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    req.user = user ?? null;
  } catch {
    req.user = null;
  }

  next();
}
