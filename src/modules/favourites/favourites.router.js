// src/modules/favourites/favourites.router.js
import { Router } from 'express';
import { index, toggle } from './favourites.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.get('/',                       authenticate, index);
router.post('/:recipeId/favourite',   authenticate, toggle);

export default router;
