import { Router } from 'express';
import {
  getChat,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
} from '../controllers/chat.controller';
//import { auth } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas de chat requieren autenticación
/**router.get('/plans/:planId', auth, getChat);
router.post('/plans/:planId/messages', auth, sendMessage);
router.put('/plans/:planId/messages/read', auth, markMessagesAsRead);
router.get('/plans/:planId/messages/unread', auth, getUnreadCount);**/

export default router;
