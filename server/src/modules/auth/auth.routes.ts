import { Router } from 'express';
import { login, refresh, logout } from './auth.controller';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.validation';

const router = Router();
router.post('/login',   validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout',  logout);
export default router;
