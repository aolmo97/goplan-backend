import { Router } from 'express';
import { register, login, googleAuth, facebookAuth, getProfile } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import passport from 'passport';
import { IUser } from '../models/User';

// Extender los tipos de Passport
declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

const router = Router();

// Rutas públicas
router.post('/register', register);
router.post('/login', login);

// Rutas de autenticación social
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  googleAuth as any // Temporal fix para el error de tipos
);

router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  facebookAuth as any // Temporal fix para el error de tipos
);

// Rutas protegidas
router.get('/profile', authenticate, getProfile);

export default router;
