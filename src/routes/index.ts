import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import planRoutes from './plan.routes';
import chatRoutes from './chat.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
//router.use('/plans', planRoutes);
//router.use('/chats', chatRoutes);

export default router;
