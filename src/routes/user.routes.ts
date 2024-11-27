import { Router } from 'express';
import {
  updateProfile,
  updateSettings,
  getUserProfile,
  getUserPlans,
  addFriend,
  removeFriend,
} from '../controllers/user.controller';
import { auth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// Rutas protegidas
router.put('/profile', auth, updateProfile);
router.put('/settings', auth, updateSettings);
router.get('/plans', auth, getUserPlans);
router.post('/friends/:friendId', auth, addFriend);
router.delete('/friends/:friendId', auth, removeFriend);

// Rutas con autenticación opcional
router.get('/:userId', optionalAuth, getUserProfile);
router.get('/:userId/plans', optionalAuth, getUserPlans);

export default router;
