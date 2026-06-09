// src/modules/likes/likes.router.js
import { Router } from 'express';
import { toggle } from './likes.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/:recipeId/like', authenticate, toggle);

export default router;
