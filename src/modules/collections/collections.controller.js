// src/modules/collections/collections.controller.js
import prisma from '../../config/database.js';
import { serializeCollection } from '../serializers.js';

// GET /api/collections
export async function index(req, res) {
  const collections = await prisma.collection.findMany({
    where:   { userId: req.user.id },
    include: {
      recipes: {
        take:    4,
        include: { images: { orderBy: { order: 'asc' } } },
      },
      _count: { select: { recipes: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(collections.map(serializeCollection));
}

// POST /api/collections
export async function store(req, res) {
  const { name, description, is_public } = req.body;

  if (!name) return res.status(422).json({ message: 'name is required.' });

  const collection = await prisma.collection.create({
    data: {
      userId:      req.user.id,
      name,
      description: description ?? null,
      isPublic:    is_public ?? false,
    },
    include: { _count: { select: { recipes: true } } },
  });

  return res.status(201).json(serializeCollection(collection));
}

// GET /api/collections/:id
export async function show(req, res) {
  const collection = await prisma.collection.findUnique({
    where:   { id: Number(req.params.id) },
    include: {
      recipes: {
        include: { images: { orderBy: { order: 'asc' } } },
      },
      _count: { select: { recipes: true } },
    },
  });

  if (!collection) return res.status(404).json({ message: 'Not found.' });
  if (collection.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });

  return res.json(serializeCollection(collection));
}

// PUT /api/collections/:id
export async function update(req, res) {
  const collection = await prisma.collection.findUnique({ where: { id: Number(req.params.id) } });

  if (!collection) return res.status(404).json({ message: 'Not found.' });
  if (collection.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });

  const { name, description, is_public } = req.body;

  const updated = await prisma.collection.update({
    where: { id: collection.id },
    data: {
      ...(name        !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(is_public   !== undefined && { isPublic: is_public }),
    },
    include: { _count: { select: { recipes: true } } },
  });

  return res.json(serializeCollection(updated));
}

// DELETE /api/collections/:id
export async function destroy(req, res) {
  const collection = await prisma.collection.findUnique({ where: { id: Number(req.params.id) } });

  if (!collection) return res.status(404).json({ message: 'Not found.' });
  if (collection.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });

  await prisma.collection.delete({ where: { id: collection.id } });

  return res.status(204).send();
}

// POST /api/collections/:id/recipes
export async function addRecipe(req, res) {
  const collection = await prisma.collection.findUnique({ where: { id: Number(req.params.id) } });

  if (!collection) return res.status(404).json({ message: 'Not found.' });
  if (collection.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });

  const { recipe_id, order } = req.body;

  if (!recipe_id) return res.status(422).json({ message: 'recipe_id is required.' });

  const existingCount = await prisma.collectionRecipe.count({ where: { collectionId: collection.id } });
  const finalOrder = order ?? existingCount;

  // upsert — mirrors syncWithoutDetaching
  await prisma.collectionRecipe.upsert({
    where: {
      collectionId_recipeId: { collectionId: collection.id, recipeId: Number(recipe_id) },
    },
    create: { collectionId: collection.id, recipeId: Number(recipe_id), order: finalOrder },
    update: { order: finalOrder },
  });

  return res.json({ message: 'Recipe added to collection.' });
}

// DELETE /api/collections/:id/recipes/:recipeId
export async function removeRecipe(req, res) {
  const collection = await prisma.collection.findUnique({ where: { id: Number(req.params.id) } });

  if (!collection) return res.status(404).json({ message: 'Not found.' });
  if (collection.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });

  await prisma.collectionRecipe.deleteMany({
    where: {
      collectionId: collection.id,
      recipeId:     Number(req.params.recipeId),
    },
  });

  return res.status(204).send();
}
