import { Router } from 'express';
import { register, login, googleAuth, facebookAuth, me } from '../controllers/auth.controller';
import { auth } from '../middleware/auth.middleware';

const router = Router();

// Rutas públicas
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/facebook', facebookAuth);

// Rutas protegidas
router.get('/me', auth, me);

export default router;
