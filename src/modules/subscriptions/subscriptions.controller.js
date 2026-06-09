// src/modules/subscriptions/subscriptions.controller.js
import stripe from '../../config/stripe.js';
import prisma from '../../config/database.js';
import { getUserPlan, isPremium, remainingFreeRecipes } from '../../middleware/premium.js';

// POST /api/subscribe
export async function checkout(req, res) {
  const { price_id } = req.body;

  if (!price_id?.startsWith('price_')) {
    return res.status(422).json({ message: 'Invalid price_id.' });
  }

  const user = req.user;

  // Ensure Stripe customer exists
  if (!user.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      name:     user.name,
      metadata: { user_id: String(user.id) },
    });

    await prisma.user.update({
      where: { id: user.id },
      data:  { stripeCustomerId: customer.id },
    });

    user.stripeCustomerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer:             user.stripeCustomerId,
    payment_method_types: ['card'],
    mode:                 'subscription',
    line_items: [{
      price:    price_id,
      quantity: 1,
    }],
    success_url:            `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:             `${process.env.FRONTEND_URL}/pricing`,
    metadata:               { user_id: String(user.id) },
    allow_promotion_codes:  true,
  });

  return res.json({ checkout_url: session.url });
}

// POST /api/billing-portal
export async function billingPortal(req, res) {
  const user = req.user;

  if (!user.stripeCustomerId) {
    return res.status(404).json({ error: 'No billing account found.' });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer:   user.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/settings/billing`,
  });

  return res.json({ portal_url: session.url });
}

// GET /api/subscription
export async function status(req, res) {
  const user = req.user;
  const sub  = user.subscriptions?.[0] ?? null;

  const recipeCount = await prisma.recipe.count({ where: { userId: user.id } });

  return res.json({
    plan:                    getUserPlan(user),
    status:                  sub?.status ?? null,
    ends_at:                 sub?.endsAt?.toISOString() ?? null,
    price_id:                sub?.stripePriceId ?? null,
    remaining_free_recipes:  remainingFreeRecipes(user, recipeCount),
  });
}
