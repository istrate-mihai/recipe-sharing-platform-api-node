// src/modules/recipes/recipes.controller.js
import prisma from '../../config/database.js';
import { serializeRecipe } from '../serializers.js';
import { uploadToR2, deleteFromR2, getFromR2 } from './r2-upload.js';
import { generateRecipePdf } from './pdf.js';

// ── Shared recipe query include ───────────────────────────────────────────────

const RECIPE_INCLUDE = {
  user:        true,
  ingredients: { orderBy: { order: 'asc' } },
  images:      { orderBy: { order: 'asc' } },
  likes:       { select: { userId: true } },
  favourites:  { select: { userId: true } },
};

// ── GET /api/recipes ──────────────────────────────────────────────────────────

export async function index(req, res) {
  const { search, category, difficulty } = req.query;
  const perPage = Math.min(Number(req.query.per_page) || 10, 100);
  const page    = Math.max(Number(req.query.page) || 1, 1);

  const where = {
    status: 'published',
    ...(search     ? { OR: [
      { title:       { contains: search,     mode: 'insensitive' } },
      { description: { contains: search,     mode: 'insensitive' } },
    ] } : {}),
    ...(category   ? { category }   : {}),
    ...(difficulty ? { difficulty } : {}),
  };

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      include:  RECIPE_INCLUDE,
      orderBy:  { createdAt: 'desc' },
      skip:     (page - 1) * perPage,
      take:     perPage,
    }),
    prisma.recipe.count({ where }),
  ]);

  const authUserId = req.user?.id ?? null;

  return res.json({
    data: recipes.map(r => serializeRecipe(r, authUserId)),
    meta: {
      current_page: page,
      last_page:    Math.ceil(total / perPage),
      per_page:     perPage,
      total,
    },
  });
}

// ── POST /api/recipes ─────────────────────────────────────────────────────────

export async function store(req, res) {
  const user = req.user;

  // Free tier limit: max 10 recipes
  if (!isPremiumUser(user)) {
    const count = await prisma.recipe.count({ where: { userId: user.id } });
    if (count >= 10) {
      return res.status(403).json({
        error:       'Free plan limit reached (10 recipes).',
        upgrade_url: `${process.env.FRONTEND_URL}/pricing`,
      });
    }
  }

  const {
    title, description, category, difficulty,
    prep_time, cook_time, servings, steps,
    status, nutritional_info, ingredients,
  } = req.body;

  // steps / nutritional_info arrive as JSON strings from FormData
  const parsedSteps  = typeof steps === 'string' ? JSON.parse(steps) : steps;
  const parsedNutri  = nutritional_info
    ? (typeof nutritional_info === 'string' ? JSON.parse(nutritional_info) : nutritional_info)
    : null;
  const parsedIngredients = ingredients
    ? (typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients)
    : [];

  const recipe = await prisma.recipe.create({
    data: {
      userId:         user.id,
      title,
      description,
      category,
      difficulty,
      prepTime:       Number(prep_time),
      cookTime:       Number(cook_time),
      servings:       servings ? Number(servings) : 4,
      steps:          parsedSteps,
      status:         status ?? 'published',
      nutritionalInfo: parsedNutri,
      ingredients: {
        create: parsedIngredients.map((ing, i) => ({
          quantity: ing.quantity !== "" && ing.quantity != null ? parseFloat(ing.quantity) : null,
          unit:     ing.unit ?? null,
          name:     ing.name,
          order:    i,
        })),
      },
    },
  });

  // Handle image uploads
  if (req.files?.length) {
    await syncImages(recipe.id, req.files, req.imageIds ?? []);
  }

  const full = await prisma.recipe.findUnique({
    where:   { id: recipe.id },
    include: RECIPE_INCLUDE,
  });

  return res.status(201).json(serializeRecipe(full, user.id));
}

// ── GET /api/recipes/:id ──────────────────────────────────────────────────────

export async function show(req, res) {
  const recipe = await prisma.recipe.findUnique({
    where:   { id: Number(req.params.id) },
    include: RECIPE_INCLUDE,
  });

  if (!recipe) return res.status(404).json({ message: 'Not found.' });

  // Non-published recipes are only visible to their owner
  if (recipe.status !== 'published') {
    if (!req.user || req.user.id !== recipe.userId) {
      return res.status(404).json({ message: 'Not found.' });
    }
  }

  return res.json(serializeRecipe(recipe, req.user?.id ?? null));
}

// ── POST /api/recipes/:id (update) ───────────────────────────────────────────

export async function update(req, res) {
  const recipe = await prisma.recipe.findUnique({ where: { id: Number(req.params.id) } });

  if (!recipe) return res.status(404).json({ message: 'Not found.' });
  if (recipe.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });

  const {
    title, description, category, difficulty,
    prep_time, cook_time, servings, steps,
    status, nutritional_info, ingredients,
  } = req.body;

  const parsedSteps = steps
    ? (typeof steps === 'string' ? JSON.parse(steps) : steps)
    : undefined;
  const parsedNutri = nutritional_info
    ? (typeof nutritional_info === 'string' ? JSON.parse(nutritional_info) : nutritional_info)
    : undefined;
  const parsedIngredients = ingredients
    ? (typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients)
    : null;

  await prisma.recipe.update({
    where: { id: recipe.id },
    data: {
      ...(title       !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(category    !== undefined && { category }),
      ...(difficulty  !== undefined && { difficulty }),
      ...(prep_time   !== undefined && { prepTime:  Number(prep_time) }),
      ...(cook_time   !== undefined && { cookTime:  Number(cook_time) }),
      ...(servings    !== undefined && { servings:  Number(servings) }),
      ...(parsedSteps !== undefined && { steps:     parsedSteps }),
      ...(status      !== undefined && { status }),
      ...(parsedNutri !== undefined && { nutritionalInfo: parsedNutri }),
    },
  });

  // Replace ingredients if sent
  if (parsedIngredients !== null) {
    await prisma.ingredient.deleteMany({ where: { recipeId: recipe.id } });
    await prisma.ingredient.createMany({
      data: parsedIngredients.map((ing, i) => ({
        recipeId: recipe.id,
        quantity: ing.quantity !== "" && ing.quantity != null ? parseFloat(ing.quantity) : null,
        unit:     ing.unit ?? null,
        name:     ing.name,
        order:    i,
      })),
    });
  }

  // Sync images if any new uploads
  if (req.files?.length || req.imageIds?.length) {
    await syncImages(recipe.id, req.files ?? [], req.imageIds ?? []);
  }

  const full = await prisma.recipe.findUnique({
    where:   { id: recipe.id },
    include: RECIPE_INCLUDE,
  });

  return res.json(serializeRecipe(full, req.user.id));
}

// ── DELETE /api/recipes/:id ───────────────────────────────────────────────────

export async function destroy(req, res) {
  const recipe = await prisma.recipe.findUnique({
    where:   { id: Number(req.params.id) },
    include: { images: true },
  });

  if (!recipe) return res.status(404).json({ message: 'Not found.' });
  if (recipe.userId !== req.user.id) return res.status(403).json({ message: 'Forbidden.' });

  // Delete images from R2
  await Promise.allSettled(recipe.images.map(img => deleteFromR2(img.path)));

  await prisma.recipe.delete({ where: { id: recipe.id } });

  return res.json({ message: 'Recipe deleted.' });
}

// ── GET /api/my-recipes ───────────────────────────────────────────────────────

export async function myRecipes(req, res) {
  const recipes = await prisma.recipe.findMany({
    where:   { userId: req.user.id },
    include: RECIPE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ data: recipes.map(r => serializeRecipe(r, req.user.id)) });
}

// ── GET /api/sitemap.xml ──────────────────────────────────────────────────────

export async function sitemap(_req, res) {
  const recipes = await prisma.recipe.findMany({
    where:   { status: 'published' },
    select:  { id: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const staticPages = [
    { loc: '/',        changefreq: 'daily',   priority: '1.0' },
    { loc: '/about',   changefreq: 'monthly', priority: '0.5' },
    { loc: '/contact', changefreq: 'monthly', priority: '0.5' },
    { loc: '/privacy', changefreq: 'monthly', priority: '0.3' },
  ];

  let urls = '';

  for (const page of staticPages) {
    urls += `  <url>\n`;
    urls += `    <loc>https://recipe-sharing-platform.com${page.loc}</loc>\n`;
    urls += `    <changefreq>${page.changefreq}</changefreq>\n`;
    urls += `    <priority>${page.priority}</priority>\n`;
    urls += `  </url>\n`;
  }

  for (const recipe of recipes) {
    const lastmod = recipe.updatedAt.toISOString().split('T')[0];
    urls += `  <url>\n`;
    urls += `    <loc>https://recipe-sharing-platform.com/recipe/${recipe.id}</loc>\n`;
    urls += `    <lastmod>${lastmod}</lastmod>\n`;
    urls += `    <changefreq>weekly</changefreq>\n`;
    urls += `    <priority>0.8</priority>\n`;
    urls += `  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}</urlset>`;

  return res.header('Content-Type', 'application/xml').send(xml);
}

// ── GET /api/recipes/:id/export-pdf ──────────────────────────────────────────

export async function exportPdf(req, res) {
  const recipe = await prisma.recipe.findUnique({
    where:   { id: Number(req.params.id) },
    include: {
      user:        true,
      ingredients: { orderBy: { order: 'asc' } },
      images:      { orderBy: { order: 'asc' } },
    },
  });

  if (!recipe) return res.status(404).json({ message: 'Not found.' });

  let imageData = null;
  const primaryImage = recipe.images.find(i => i.isPrimary) ?? recipe.images[0];

  if (primaryImage) {
    try {
      const { buffer, contentType } = await getFromR2(primaryImage.path);
      imageData = `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch (e) {
      console.error('Failed to fetch recipe image for PDF:', e.message);
    }
  }

  const pdfBuffer = await generateRecipePdf(recipe, imageData);
  const slug = recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${slug}-recipe-card.pdf"`);
  return res.send(pdfBuffer);
}

// ── Private helpers ───────────────────────────────────────────────────────────

function isPremiumUser(user) {
  const sub = user.subscriptions?.[0];
  if (!sub) return false;
  if (sub.status === 'active') return true;
  if (sub.status === 'canceled' && sub.endsAt && new Date(sub.endsAt) > new Date()) return true;
  return false;
}

/**
 * Mirrors Laravel's RecipeController::syncImages().
 * - existingIds: array of image DB ids to KEEP (sent from frontend on update)
 * - req.files:   new multer files to upload
 */
async function syncImages(recipeId, newFiles = [], existingIdsRaw = []) {
  const keepIds = Array.isArray(existingIdsRaw)
    ? existingIdsRaw.map(Number)
    : [Number(existingIdsRaw)].filter(Boolean);

  // Delete images not in keepIds
  const toDelete = await prisma.recipeImage.findMany({
    where: { recipeId, id: { notIn: keepIds } },
  });

  await Promise.allSettled(toDelete.map(img => deleteFromR2(img.path)));
  await prisma.recipeImage.deleteMany({
    where: { id: { in: toDelete.map(i => i.id) } },
  });

  // Re-index kept images
  const kept = await prisma.recipeImage.findMany({
    where:   { recipeId, id: { in: keepIds } },
    orderBy: { order: 'asc' },
  });

  for (let i = 0; i < kept.length; i++) {
    await prisma.recipeImage.update({
      where: { id: kept[i].id },
      data:  { order: i, isPrimary: i === 0 },
    });
  }

  // Upload new files
  const offset = kept.length;
  for (let i = 0; i < newFiles.length; i++) {
    const path = await uploadToR2(newFiles[i]);
    await prisma.recipeImage.create({
      data: {
        recipeId,
        path,
        order:     offset + i,
        isPrimary: offset === 0 && i === 0,
      },
    });
  }
}
