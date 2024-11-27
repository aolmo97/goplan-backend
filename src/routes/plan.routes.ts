import { Router } from 'express';
import {
  createPlan,
  updatePlan,
  getPlan,
  getPlans,
  joinPlan,
  leavePlan,
  updateParticipantStatus,
} from '../controllers/plan.controller';
import { auth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// Rutas protegidas
router.post('/', auth, createPlan);
router.put('/:planId', auth, updatePlan);
router.post('/:planId/join', auth, joinPlan);
router.post('/:planId/leave', auth, leavePlan);
router.put('/:planId/participants/:participantId', auth, updateParticipantStatus);

// Rutas con autenticación opcional
router.get('/', optionalAuth, getPlans);
router.get('/:planId', optionalAuth, getPlan);

export default router;
