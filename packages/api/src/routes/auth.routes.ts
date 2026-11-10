import { Router } from 'express';
import { register, login, getMe, updateProfile } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '@voltshare/shared';

const router = Router();

/** POST /api/auth/register — Create a new account */
router.post('/register', validate(registerSchema), register);

/** POST /api/auth/login — Authenticate and get a JWT */
router.post('/login', validate(loginSchema), login);

/** GET /api/auth/me — Get current user profile (requires auth) */
router.get('/me', authenticate, getMe);

/** PUT /api/auth/profile — Update profile fields (requires auth) */
router.put('/profile', authenticate, updateProfile);

export default router;
