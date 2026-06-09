// src/modules/webhook/webhook.controller.js
import stripe from '../../config/stripe.js';
import prisma from '../../config/database.js';

export async function handle(req, res) {
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    // req.body is a raw Buffer here (express.raw middleware applied in app.js)
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const obj = event.data.object;

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await upsertSubscription(obj);
        break;

      case 'customer.subscription.deleted':
        await markCanceled(obj);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(obj);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(obj);
        break;

      default:
        break; // safely ignore all other events
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err);
    // Still return 200 — Stripe retries if we return non-2xx
  }

  return res.status(200).send('OK');
}

async function upsertSubscription(sub) {
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: sub.customer },
  });

  if (!user) {
    console.warn('Stripe webhook: no user found for customer', sub.customer);
    return;
  }

  const endsAt = sub.cancel_at
    ? new Date(sub.cancel_at * 1000)
    : null;

  await prisma.subscription.upsert({
    where:  { stripeId: sub.id },
    create: {
      userId:          user.id,
      stripeId:        sub.id,
      stripeCustomerId: sub.customer,
      stripePriceId:   sub.items.data[0].price.id,
      status:          sub.status,
      endsAt,
    },
    update: {
      stripeCustomerId: sub.customer,
      stripePriceId:   sub.items.data[0].price.id,
      status:          sub.status,
      endsAt,
    },
  });
}

async function markCanceled(sub) {
  await prisma.subscription.updateMany({
    where: { stripeId: sub.id },
    data:  { status: 'canceled', endsAt: new Date() },
  });
}

async function handlePaymentSucceeded(invoice) {
  if (!invoice.subscription) return;

  await prisma.subscription.updateMany({
    where: { stripeId: invoice.subscription },
    data:  { status: 'active' },
  });
}

async function handlePaymentFailed(invoice) {
  if (!invoice.subscription) return;

  await prisma.subscription.updateMany({
    where: { stripeId: invoice.subscription },
    data:  { status: 'past_due' },
  });
}
