// src/modules/webhook/webhook.router.js
import { Router } from 'express';
import { handle } from './webhook.controller.js';

const router = Router();

// ⚠️  express.raw() is REQUIRED here — Stripe signature verification needs raw body bytes.
//     This route must be registered BEFORE express.json() in app.js.
router.post('/stripe', handle);

export default router;
