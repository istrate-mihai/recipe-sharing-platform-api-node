// src/modules/collections/collections.router.js
import { Router } from 'express';
import {
  index, store, show, update, destroy,
  addRecipe, removeRecipe,
} from './collections.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.get('/',                               authenticate, index);
router.post('/',                              authenticate, store);
router.get('/:id',                            authenticate, show);
router.put('/:id',                            authenticate, update);
router.delete('/:id',                         authenticate, destroy);
router.post('/:id/recipes',                   authenticate, addRecipe);
router.delete('/:id/recipes/:recipeId',       authenticate, removeRecipe);

export default router;
