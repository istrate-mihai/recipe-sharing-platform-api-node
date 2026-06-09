// src/modules/auth/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database.js';
import { serializeUser } from '../serializers.js';

function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '30d' }
  );
}

async function getUserWithSub(id) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { recipes: true } },
    },
  });
}

// POST /api/auth/register
export async function register(req, res) {
  const { name, email, password, bio } = req.body;

  if (!name || !email || !password) {
    return res.status(422).json({ message: 'name, email and password are required.' });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return res.status(422).json({ errors: { email: ['The email has already been taken.'] } });
  }

  const hashed = await bcrypt.hash(password, 12);
  const avatar = name.slice(0, 2).toUpperCase(); // initials fallback

  const user = await prisma.user.create({
    data: { name, email, password: hashed, bio: bio ?? null, avatar },
  });

  const fullUser = await getUserWithSub(user.id);
  const token = signToken(user.id);

  return res.status(201).json({
    user:  serializeUser(fullUser, fullUser._count.recipes),
    token,
  });
}

// POST /api/auth/login
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({ message: 'email and password are required.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.status(422).json({
      errors: { email: ['The provided credentials are incorrect.'] },
    });
  }

  const fullUser = await getUserWithSub(user.id);
  const token = signToken(user.id);

  return res.json({
    user:  serializeUser(fullUser, fullUser._count.recipes),
    token,
  });
}

// POST /api/auth/logout
export async function logout(req, res) {
  // JWT is stateless — logout is handled client-side by deleting the token.
  // If you need server-side invalidation, add a token blocklist table.
  return res.json({ message: 'Logged out successfully.' });
}

// GET /api/auth/me
export async function me(req, res) {
  const fullUser = await getUserWithSub(req.user.id);
  return res.json(serializeUser(fullUser, fullUser._count.recipes));
}
