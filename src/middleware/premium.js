// src/middleware/premium.js

/**
 * Mirrors Laravel's CheckPremium middleware.
 * Must be used AFTER authenticate().
 */
export function requirePremium(req, res, next) {
  if (!isPremium(req.user)) {
    return res.status(403).json({
      error:       'This feature requires a Premium subscription.',
      upgrade_url: `${process.env.FRONTEND_URL}/pricing`,
    });
  }
  next();
}

/**
 * Shared helper — mirrors User::isPremium() and Subscription::isActive()
 */
export function isPremium(user) {
  if (!user?.subscriptions?.length) return false;

  const sub = user.subscriptions[0]; // already ordered by createdAt desc

  if (sub.status === 'active') return true;

  if (sub.status === 'canceled' && sub.endsAt && new Date(sub.endsAt) > new Date()) {
    return true;
  }

  return false;
}

/**
 * Mirrors User::plan()
 */
export function getUserPlan(user) {
  return isPremium(user) ? 'premium' : 'free';
}

/**
 * Mirrors User::remainingFreeRecipes()
 */
export function remainingFreeRecipes(user, recipeCount) {
  if (isPremium(user)) return null;
  return Math.max(0, 10 - recipeCount);
}
