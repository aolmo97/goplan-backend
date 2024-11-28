import { Router } from 'express';
import { 
  updateProfile, 
  getUserPlans,
  addFriend,
  removeFriend,
  uploadAvatar,
  uploadPhotos,
  deletePhoto,
  getUserProfile
} from '../controllers/user.controller';
import { getProfile } from '../controllers/auth.controller';
import { authenticate as auth, optionalAuth } from '../middleware/auth.middleware';
import { uploadImage, uploadImages } from '../services/upload.service';

const router = Router();

// Rutas protegidas
router.get('/profile', auth, getProfile); // Obtener perfil propio
router.get('/:userId', optionalAuth, getProfile); // Obtener perfil de otro usuario
router.put('/profile', auth, updateProfile);
router.post('/avatar', auth, uploadImage, uploadAvatar);
router.get('/plans', auth, getUserPlans);
router.post('/friends/:friendId', auth, addFriend);
router.delete('/friends/:friendId', auth, removeFriend);

// Nuevas rutas para gestión de fotos
router.post('/photos', auth, uploadImages, uploadPhotos);
router.delete('/photos/:photoId', auth, deletePhoto);

// Rutas con autenticación opcional 
router.get('/:userId/plans', optionalAuth, getUserPlans);

export default router;
