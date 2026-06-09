// src/modules/favourites/favourites.controller.js
import prisma from '../../config/database.js';
import { serializeRecipe } from '../serializers.js';

const RECIPE_INCLUDE = {
  user:       true,
  likes:      { select: { userId: true } },
  favourites: { select: { userId: true } },
};

// GET /api/favourites
export async function index(req, res) {
  const favourites = await prisma.favourite.findMany({
    where:   { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      recipe: { include: RECIPE_INCLUDE },
    },
  });

  const recipes = favourites.map(f => serializeRecipe(f.recipe, req.user.id));
  return res.json(recipes);
}

// POST /api/recipes/:recipeId/favourite
export async function toggle(req, res) {
  const recipeId = Number(req.params.recipeId);
  const userId   = req.user.id;

  const existing = await prisma.favourite.findUnique({
    where: { userId_recipeId: { userId, recipeId } },
  });

  if (existing) {
    await prisma.favourite.delete({ where: { userId_recipeId: { userId, recipeId } } });
    return res.json({ favourited: false });
  }

  await prisma.favourite.create({ data: { userId, recipeId } });
  return res.json({ favourited: true });
}
