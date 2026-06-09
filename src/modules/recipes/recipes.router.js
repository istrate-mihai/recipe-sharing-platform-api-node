// src/modules/recipes/recipes.router.js
import { Router } from 'express';
import {
  index, store, show, update, destroy,
  myRecipes, exportPdf, sitemap,
} from './recipes.controller.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requirePremium } from '../../middleware/premium.js';
import { uploadImages } from '../../middleware/upload.js';

const router = Router();

router.get('/',                          optionalAuth, index);
router.post('/',                         authenticate, uploadImages, store);
router.get('/my-recipes',                authenticate, myRecipes);
router.get('/sitemap.xml',               sitemap);
router.get('/:id',                       optionalAuth, show);
router.post('/:id',                      authenticate, uploadImages, update);  // POST mirrors Laravel (FormData friendly)
router.delete('/:id',                    authenticate, destroy);
router.get('/:id/export-pdf',            authenticate, requirePremium, exportPdf);

export default router;
