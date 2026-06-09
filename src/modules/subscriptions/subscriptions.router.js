// src/modules/subscriptions/subscriptions.router.js
import { Router } from 'express';
import { checkout, billingPortal, status } from './subscriptions.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/subscribe',       authenticate, checkout);
router.post('/billing-portal',  authenticate, billingPortal);
router.get('/subscription',     authenticate, status);

export default router;
