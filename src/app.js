// src/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRouter          from './modules/auth/auth.router.js';
import recipesRouter       from './modules/recipes/recipes.router.js';
import collectionsRouter   from './modules/collections/collections.router.js';
import favouritesRouter    from './modules/favourites/favourites.router.js';
import likesRouter         from './modules/likes/likes.router.js';
import profileRouter       from './modules/profile/profile.router.js';
import subscriptionsRouter from './modules/subscriptions/subscriptions.router.js';
import webhookRouter       from './modules/webhook/webhook.router.js';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
  ],
  credentials: true,
}));

// ── Webhook MUST come BEFORE express.json() ───────────────────────────────────
// Stripe signature verification requires the raw body buffer.
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRouter);

// ── JSON body parser (all other routes) ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRouter);
app.use('/api/recipes',    recipesRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/favourites', favouritesRouter);
app.use('/api/recipes',    likesRouter);         // POST /api/recipes/:id/like
app.use('/api/profile',    profileRouter);
app.use('/api/users',      profileRouter);       // GET /api/users/:userId reuses profile router
app.use('/api',            subscriptionsRouter); // /api/subscribe, /api/billing-portal, /api/subscription

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/up', (_req, res) => res.json({ status: 'ok' }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Not found.' }));

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ message: err.message ?? 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`🚀 Recipe API running on port ${PORT}`);
});

export default app;
