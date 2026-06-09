// src/modules/profile/profile.router.js
import { Router } from 'express';
import { show, showPublic, update } from './profile.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { uploadAvatar } from '../../middleware/upload.js';

const router = Router();

router.get('/',        authenticate, show);
router.post('/',       authenticate, uploadAvatar, update);
router.get('/:userId', showPublic);

export default router;
