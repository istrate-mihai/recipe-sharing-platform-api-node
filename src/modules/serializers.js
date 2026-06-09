// src/modules/serializers.js
import { r2Url } from '../config/r2.js';
import { isPremium, getUserPlan, remainingFreeRecipes } from '../middleware/premium.js';

export function serializeUser(user, recipeCount = 0) {
  const sub = user.subscriptions?.[0] ?? null;
  return {
    id:                      user.id,
    name:                    user.name,
    email:                   user.email,
    avatar:                  user.avatar,
    bio:                     user.bio,
    created_at:              user.createdAt,
    plan:                    getUserPlan(user),
    subscription_status:     sub?.status ?? null,
    remaining_free_recipes:  remainingFreeRecipes(user, recipeCount),
    recipe_count:            recipeCount,
  };
}

export function serializeIngredient(ing) {
  return {
    id:       ing.id,
    quantity: ing.quantity,
    unit:     ing.unit,
    name:     ing.name,
    order:    ing.order,
  };
}

export function serializeImage(img) {
  return {
    id:         img.id,
    path:       img.path,
    order:      img.order,
    is_primary: img.isPrimary,
    url:        r2Url(img.path),
  };
}

export function serializeRecipe(recipe, authUserId = null) {
  const likedByIds      = recipe.likes?.map(l => l.userId) ?? [];
  const favouritedByIds = recipe.favourites?.map(f => f.userId) ?? [];

  return {
    id:               recipe.id,
    title:            recipe.title,
    description:      recipe.description,
    category:         recipe.category,
    difficulty:       recipe.difficulty,
    prep_time:        recipe.prepTime,
    cook_time:        recipe.cookTime,
    steps:            recipe.steps,
    likes_count:      recipe.likesCount,
    created_at:       recipe.createdAt,
    updated_at:       recipe.updatedAt,
    status:           recipe.status,
    servings:         recipe.servings,
    nutritional_info: recipe.nutritionalInfo,

    author: {
      id:     recipe.user.id,
      name:   recipe.user.name,
      avatar: recipe.user.avatar,
    },

    is_liked:      authUserId ? likedByIds.includes(authUserId)      : false,
    is_favourited: authUserId ? favouritedByIds.includes(authUserId) : false,
    is_owner:      authUserId ? authUserId === recipe.userId         : false,

    ingredients: recipe.ingredients?.map(serializeIngredient) ?? undefined,
    images:      recipe.images?.map(serializeImage) ?? undefined,
  };
}

export function serializeCollection(collection) {
  return {
    id:           collection.id,
    name:         collection.name,
    description:  collection.description,
    is_public:    collection.isPublic,
    recipe_count: collection._count?.recipes ?? collection.recipes?.length ?? 0,
    recipes:      collection.recipes?.map(r => serializeRecipe(r)) ?? undefined,
    created_at:   collection.createdAt,
  };
}
