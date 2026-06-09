// src/modules/likes/likes.controller.js
import prisma from '../../config/database.js';

// POST /api/recipes/:recipeId/like
export async function toggle(req, res) {
  const recipeId = Number(req.params.recipeId);
  const userId   = req.user.id;

  const existing = await prisma.like.findUnique({
    where: { userId_recipeId: { userId, recipeId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { userId_recipeId: { userId, recipeId } } });
    await prisma.recipe.update({
      where: { id: recipeId },
      data:  { likesCount: { decrement: 1 } },
    });
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    return res.json({ liked: false, likes_count: recipe.likesCount });
  }

  await prisma.like.create({ data: { userId, recipeId } });
  await prisma.recipe.update({
    where: { id: recipeId },
    data:  { likesCount: { increment: 1 } },
  });

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  return res.json({ liked: true, likes_count: recipe.likesCount });
}
