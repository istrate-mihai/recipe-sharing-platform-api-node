// src/modules/profile/profile.controller.js
import bcrypt from 'bcryptjs';
import prisma from '../../config/database.js';
import { serializeUser, serializeRecipe } from '../serializers.js';
import { uploadToR2, deleteFromR2 } from '../recipes/r2-upload.js';

const RECIPE_INCLUDE = {
  user:       true,
  likes:      { select: { userId: true } },
  favourites: { select: { userId: true } },
};

async function getUserWithSub(id) {
  return prisma.user.findUnique({
    where:   { id },
    include: {
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { recipes: true } },
    },
  });
}

// GET /api/profile
export async function show(req, res) {
  const user = await getUserWithSub(req.user.id);

  const recipes = await prisma.recipe.findMany({
    where:   { userId: user.id },
    include: RECIPE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    user:    serializeUser(user, user._count.recipes),
    recipes: recipes.map(r => serializeRecipe(r, user.id)),
  });
}

// GET /api/users/:userId
export async function showPublic(req, res) {
  const user = await getUserWithSub(Number(req.params.userId));

  if (!user) return res.status(404).json({ message: 'Not found.' });

  const recipes = await prisma.recipe.findMany({
    where:   { userId: user.id, status: 'published' },
    include: RECIPE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    user:    serializeUser(user, user._count.recipes),
    recipes: recipes.map(r => serializeRecipe(r, null)),
  });
}

// POST /api/profile
export async function update(req, res) {
  const user = req.user;
  const { name, email, bio, password } = req.body;

  const data = {};

  if (name  !== undefined) data.name  = name;
  if (email !== undefined) data.email = email;
  if (bio   !== undefined) data.bio   = bio;

  if (password) {
    data.password = await bcrypt.hash(password, 12);
  }

  // Handle avatar upload — goes to R2 under "avatars/" folder
  if (req.file) {
    // Delete old R2 avatar if it was a stored path (not initials string like "MI")
    if (user.avatar && user.avatar.includes('/')) {
      await deleteFromR2(user.avatar).catch(() => {});
    }
    data.avatar = await uploadToR2(req.file, 'avatars');
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  const full    = await getUserWithSub(updated.id);

  return res.json(serializeUser(full, full._count.recipes));
}
