import { Request, Response } from 'express';
import Plan from '../models/Plan';
import User from '../models/User';
import Chat from '../models/Chat';
import { PlanError } from '../utils/errors';

export const createPlan = async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const planData = {
      ...req.body,
      creator: user._id,
      participants: [{ user: user._id, status: 'accepted', role: 'creator' }],
    };

    const plan = new Plan(planData);
    await plan.save();

    // Crear chat para el plan
    const chat = new Chat({
      plan: plan._id,
      participants: [user._id],
    });
    await chat.save();

    // Actualizar usuario
    await User.findByIdAndUpdate(
      user._id,
      { $push: { plansCreated: plan._id } }
    );

    const populatedPlan = await Plan.findById(plan._id)
      .populate('creator', 'name avatar')
      .populate('participants.user', 'name avatar');

    res.status(201).json({ plan: populatedPlan });
  } catch (error) {
    console.error('Error al crear plan:', error);
    res.status(400).json({ message: 'Error al crear plan' });
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { user } = req;
    const updates = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new PlanError('Plan no encontrado');
    }

    // Verificar permisos
    const participant = plan.participants.find(p => p.user.equals(user._id));
    if (!participant || !['creator', 'admin'].includes(participant.role)) {
      throw new PlanError('No tienes permisos para editar este plan');
    }

    // Campos que no se pueden actualizar directamente
    const restrictedFields = ['creator', 'participants'];
    restrictedFields.forEach(field => delete updates[field]);

    const updatedPlan = await Plan.findByIdAndUpdate(
      planId,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('creator', 'name avatar')
      .populate('participants.user', 'name avatar');

    res.json({ plan: updatedPlan });
  } catch (error) {
    console.error('Error al actualizar plan:', error);
    res.status(400).json({ message: error instanceof PlanError ? error.message : 'Error al actualizar plan' });
  }
};

export const getPlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { user } = req;

    const plan = await Plan.findById(planId)
      .populate('creator', 'name avatar')
      .populate('participants.user', 'name avatar');

    if (!plan) {
      throw new PlanError('Plan no encontrado');
    }

    // Verificar acceso
    if (plan.privacy === 'private') {
      const isParticipant = plan.participants.some(p => p.user.equals(user._id));
      if (!isParticipant) {
        throw new PlanError('No tienes acceso a este plan');
      }
    }

    res.json({ plan });
  } catch (error) {
    console.error('Error al obtener plan:', error);
    res.status(404).json({ message: error instanceof PlanError ? error.message : 'Error al obtener plan' });
  }
};

export const getPlans = async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const { status, type, search } = req.query;

    const query: any = {
      $or: [
        { privacy: 'public' },
        { 'participants.user': user._id },
        { creator: user._id }
      ]
    };

    if (status) {
      query.status = status;
    }

    if (type === 'created') {
      query.creator = user._id;
    } else if (type === 'joined') {
      query['participants.user'] = user._id;
      query['participants.status'] = 'accepted';
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const plans = await Plan.find(query)
      .populate('creator', 'name avatar')
      .populate('participants.user', 'name avatar')
      .sort({ dateTime: -1 });

    res.json({ plans });
  } catch (error) {
    console.error('Error al obtener planes:', error);
    res.status(500).json({ message: 'Error al obtener planes' });
  }
};

export const joinPlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { user } = req;

    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new PlanError('Plan no encontrado');
    }

    if (plan.participants.some(p => p.user.equals(user._id))) {
      throw new PlanError('Ya eres participante de este plan');
    }

    // Agregar participante al plan
    await Plan.findByIdAndUpdate(
      planId,
      { 
        $push: { 
          participants: { 
            user: user._id, 
            status: 'pending',
            role: 'participant'
          } 
        } 
      }
    );

    // Agregar usuario al chat del plan
    await Chat.findOneAndUpdate(
      { plan: planId },
      { $addToSet: { participants: user._id } }
    );

    // Actualizar usuario
    await User.findByIdAndUpdate(
      user._id,
      { $push: { plansJoined: planId } }
    );

    const updatedPlan = await Plan.findById(planId)
      .populate('creator', 'name avatar')
      .populate('participants.user', 'name avatar');

    res.json({ plan: updatedPlan });
  } catch (error) {
    console.error('Error al unirse al plan:', error);
    res.status(400).json({ message: error instanceof PlanError ? error.message : 'Error al unirse al plan' });
  }
};

export const leavePlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { user } = req;

    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new PlanError('Plan no encontrado');
    }

    const participant = plan.participants.find(p => p.user.equals(user._id));
    if (!participant) {
      throw new PlanError('No eres participante de este plan');
    }

    if (participant.role === 'creator') {
      throw new PlanError('El creador no puede abandonar el plan');
    }

    // Remover participante del plan
    await Plan.findByIdAndUpdate(
      planId,
      { $pull: { participants: { user: user._id } } }
    );

    // Remover usuario del chat
    await Chat.findOneAndUpdate(
      { plan: planId },
      { $pull: { participants: user._id } }
    );

    // Actualizar usuario
    await User.findByIdAndUpdate(
      user._id,
      { $pull: { plansJoined: planId } }
    );

    const updatedPlan = await Plan.findById(planId)
      .populate('creator', 'name avatar')
      .populate('participants.user', 'name avatar');

    res.json({ plan: updatedPlan });
  } catch (error) {
    console.error('Error al abandonar plan:', error);
    res.status(400).json({ message: error instanceof PlanError ? error.message : 'Error al abandonar plan' });
  }
};

export const updateParticipantStatus = async (req: Request, res: Response) => {
  try {
    const { planId, participantId } = req.params;
    const { status } = req.body;
    const { user } = req;

    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new PlanError('Plan no encontrado');
    }

    // Verificar permisos
    const requester = plan.participants.find(p => p.user.equals(user._id));
    if (!requester || !['creator', 'admin'].includes(requester.role)) {
      throw new PlanError('No tienes permisos para actualizar participantes');
    }

    await Plan.findOneAndUpdate(
      { _id: planId, 'participants.user': participantId },
      { $set: { 'participants.$.status': status } }
    );

    if (status === 'accepted') {
      await User.findByIdAndUpdate(
        participantId,
        { $addToSet: { plansJoined: planId } }
      );
    } else if (status === 'rejected') {
      await User.findByIdAndUpdate(
        participantId,
        { $pull: { plansJoined: planId } }
      );
    }

    const updatedPlan = await Plan.findById(planId)
      .populate('creator', 'name avatar')
      .populate('participants.user', 'name avatar');

    res.json({ plan: updatedPlan });
  } catch (error) {
    console.error('Error al actualizar estado de participante:', error);
    res.status(400).json({ message: error instanceof PlanError ? error.message : 'Error al actualizar estado de participante' });
  }
};
