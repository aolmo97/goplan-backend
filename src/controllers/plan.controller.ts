import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import Plan, { IPlan } from '../models/Plan';
import User, { IUser } from '../models/User';
import Chat from '../models/Chat';
import { PlanError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth.middleware';

// Interfaz para el participante
interface IParticipant {
  user: Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected';
  joinedAt: Date;
  role?: 'creator' | 'admin' | 'participant';
}

export const createPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('Iniciando creación de plan con datos:', JSON.stringify(req.body, null, 2));
    
    const user = req.user as IUser;
    if (!user) {
      console.log('Usuario no autenticado');
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    // Validar campos requeridos
    const requiredFields = ['title', 'description', 'category', 'date', 'time', 'location'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      console.log('Campos requeridos faltantes:', missingFields);
      res.status(400).json({
        message: 'Faltan campos requeridos',
        fields: missingFields
      });
      return;
    }

    console.log('Procesando fecha y hora...');
    // Procesar fecha y hora
    let dateTime;
    try {
      const eventDate = new Date(req.body.date);
      const eventTime = new Date(req.body.time);
      console.log('Fecha recibida:', eventDate);
      console.log('Hora recibida:', eventTime);
      
      dateTime = new Date(
        eventDate.getFullYear(),
        eventDate.getMonth(),
        eventDate.getDate(),
        eventTime.getHours(),
        eventTime.getMinutes()
      );
      console.log('Fecha y hora combinada:', dateTime);
      
      if (isNaN(dateTime.getTime())) {
        throw new Error('Fecha u hora inválida');
      }
    } catch (error) {
      console.error('Error al procesar fecha y hora:', error);
      res.status(400).json({ 
        message: 'Formato de fecha u hora inválido',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      return;
    }

    // Validar que la fecha no sea en el pasado
    if (dateTime < new Date()) {
      console.log('Fecha en el pasado:', dateTime);
      res.status(400).json({ message: 'La fecha del plan no puede ser en el pasado' });
      return;
    }

    console.log('Procesando imágenes...');
    // Procesar imágenes
    const images = (req.body.images || []).map((url: string) => {
      console.log('Procesando imagen:', url);
      return {
        type: 'image',
        url
      };
    });

    // Determinar el número máximo de participantes
    console.log('Tipo de compañía:', req.body.companionType);
    let maxParticipants;
    switch (req.body.companionType) {
      case 'Individual':
        maxParticipants = 2;
        break;
      case 'Pareja':
        maxParticipants = 2;
        break;
      case 'Grupo pequeño':
        maxParticipants = 6;
        break;
      case 'Grupo grande':
        maxParticipants = 20;
        break;
      default:
        maxParticipants = parseInt(req.body.maxParticipants) || 2;
    }
    console.log('Número máximo de participantes:', maxParticipants);

    const planData = {
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      creator: user._id,
      category: req.body.category,
      location: {
        type: 'Point',
        coordinates: [0, 0],
        address: req.body.location,
        city: '',
      },
      dateTime,
      duration: 120,
      maxParticipants,
      participants: [{
        user: user._id,
        status: 'accepted',
        role: 'creator',
        joinedAt: new Date()
      }],
      tags: [],
      privacy: req.body.isPublic ? 'public' : 'friends',
      status: 'active',
      media: images,
      chat: undefined as unknown as Types.ObjectId,
    };

    console.log('Creando plan con datos:', JSON.stringify(planData, null, 2));

    // Crear el plan
    const plan = new Plan(planData);
    await plan.save();
    console.log('Plan guardado con ID:', plan._id);

    // Crear chat asociado al plan
    console.log('Creando chat para el plan...');
    const chat = new Chat({
      plan: plan._id,
      participants: [user._id],
      messages: []
    });
    await chat.save();
    console.log('Chat creado con ID:', chat._id);

    // Actualizar el plan con la referencia al chat
    plan.chat = chat._id as Types.ObjectId;
    await plan.save();
    console.log('Plan actualizado con referencia al chat');

    console.log('Enviando respuesta exitosa');
    res.status(201).json({
      success: true,
      plan: {
        ...plan.toObject(),
        chat: chat._id
      }
    });
  } catch (error: any) {
    console.error('Error detallado al crear plan:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Error al crear el plan', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const updatePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    if (!user) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const { planId } = req.params;
    const plan = await Plan.findById(planId);

    if (!plan) {
      res.status(404).json({ message: 'Plan no encontrado' });
      return;
    }

    const participant = plan.participants.find(
      p => p.user.equals(user._id)
    ) as IParticipant;

    if (!participant || !['creator', 'admin'].includes(participant.role || '')) {
      res.status(403).json({ message: 'No tienes permisos para actualizar este plan' });
      return;
    }

    // Actualizar plan
    Object.assign(plan, req.body);
    await plan.save();

    res.json(plan);
  } catch (error: any) {
    console.error('Error al actualizar plan:', error);
    res.status(500).json({ message: 'Error al actualizar el plan', error: error.message });
  }
};

export const getPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    const { planId } = req.params;

    const plan = await Plan.findById(planId)
      .populate('creator', 'name email photo')
      .populate('participants.user', 'name email photo');

    if (!plan) {
      res.status(404).json({ message: 'Plan no encontrado' });
      return;
    }

    if (plan.privacy === 'private') {
      if (!user) {
        res.status(401).json({ message: 'Necesitas estar autenticado para ver este plan' });
        return;
      }

      const isParticipant = plan.participants.some(p => p.user.equals(user._id));
      if (!isParticipant && !plan.creator.equals(user._id)) {
        res.status(403).json({ message: 'No tienes permiso para ver este plan' });
        return;
      }
    }

    res.json(plan);
  } catch (error: any) {
    console.error('Error al obtener plan:', error);
    res.status(500).json({ message: 'Error al obtener el plan', error: error.message });
  }
};

export const getPlans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    const { privacy, status, category } = req.query;
    const query: any = {};

    // Filtros básicos
    if (privacy) query.privacy = privacy;
    if (status) query.status = status;
    if (category) query.category = category;

    // Si el usuario está autenticado, incluir planes privados donde es participante
    if (user) {
      query.$or = [
        { privacy: 'public' },
        { 'participants.user': user._id },
        { creator: user._id }
      ];
    } else {
      query.privacy = 'public';
    }

    // Filtros adicionales para usuarios autenticados
    if (user && req.query.filter === 'my-plans') {
      query.creator = user._id;
    } else if (user && req.query.filter === 'participating') {
      query['participants.user'] = user._id;
    }

    const plans = await Plan.find(query)
      .populate('creator', 'name email photo')
      .populate('participants.user', 'name email photo')
      .sort({ dateTime: 1 });

    res.json(plans);
  } catch (error: any) {
    console.error('Error al obtener planes:', error);
    res.status(500).json({ message: 'Error al obtener los planes', error: error.message });
  }
};

export const joinPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    if (!user) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const { planId } = req.params;
    const plan = await Plan.findById(planId);

    if (!plan) {
      res.status(404).json({ message: 'Plan no encontrado' });
      return;
    }

    if (plan.participants.some(p => p.user.equals(user._id))) {
      res.status(400).json({ message: 'Ya eres participante de este plan' });
      return;
    }

    if (plan.maxParticipants && plan.participants.length >= plan.maxParticipants) {
      res.status(400).json({ message: 'El plan ha alcanzado el máximo de participantes' });
      return;
    }

    // Agregar al usuario como participante
    plan.participants.push({
      user: user._id,
      status: 'pending',
      joinedAt: new Date()
    });

    await plan.save();

    // Actualizar el chat si existe
    if (plan.chat) {
      await Chat.findByIdAndUpdate(
        plan.chat,
        { $addToSet: { participants: user._id } }
      );
    }

    // Notificar al creador del plan
    // TODO: Implementar notificaciones
    await notifyUser(
      user._id,
      plan.creator,
      'join_request',
      `${user.name} quiere unirse a tu plan "${plan.title}"`
    );

    res.json(plan);
  } catch (error: any) {
    console.error('Error al unirse al plan:', error);
    res.status(500).json({ message: 'Error al unirse al plan', error: error.message });
  }
};

export const leavePlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    if (!user) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const { planId } = req.params;
    const plan = await Plan.findById(planId);

    if (!plan) {
      res.status(404).json({ message: 'Plan no encontrado' });
      return;
    }

    const participant = plan.participants.find(p => p.user.equals(user._id)) as IParticipant;

    if (!participant) {
      res.status(400).json({ message: 'No eres participante de este plan' });
      return;
    }

    if (participant.role === 'creator') {
      res.status(400).json({ message: 'El creador no puede abandonar el plan' });
      return;
    }

    // Remover al usuario de los participantes
    await Plan.findByIdAndUpdate(
      planId,
      { $pull: { participants: { user: user._id } } }
    );

    // Actualizar el chat si existe
    if (plan.chat) {
      await Chat.findByIdAndUpdate(
        plan.chat,
        { $pull: { participants: user._id } }
      );
    }

    // Notificar al creador del plan
    // TODO: Implementar notificaciones
    await notifyUser(
      user._id,
      plan.creator,
      'leave_plan',
      `${user.name} ha abandonado tu plan "${plan.title}"`
    );

    res.json({ message: 'Has abandonado el plan exitosamente' });
  } catch (error: any) {
    console.error('Error al abandonar el plan:', error);
    res.status(500).json({ message: 'Error al abandonar el plan', error: error.message });
  }
};

export const updateParticipantStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    if (!user) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const { planId, participantId } = req.params;
    const { status } = req.body;

    const plan = await Plan.findById(planId);

    if (!plan) {
      res.status(404).json({ message: 'Plan no encontrado' });
      return;
    }

    const requester = plan.participants.find(p => p.user.equals(user._id)) as IParticipant;
    if (!requester || !['creator', 'admin'].includes(requester.role || '')) {
      res.status(403).json({ message: 'No tienes permisos para actualizar el estado de los participantes' });
      return;
    }

    const participantIndex = plan.participants.findIndex(p => p.user.toString() === participantId);
    if (participantIndex === -1) {
      res.status(404).json({ message: 'Participante no encontrado' });
      return;
    }

    plan.participants[participantIndex].status = status;
    await plan.save();

    // Notificar al participante del cambio de estado
    // TODO: Implementar notificaciones
    await notifyUser(
      user._id,
      plan.participants[participantIndex].user,
      'status_update',
      `Tu estado en el plan "${plan.title}" ha sido actualizado a ${status}`
    );

    res.json(plan);
  } catch (error: any) {
    console.error('Error al actualizar estado del participante:', error);
    res.status(500).json({ 
      message: 'Error al actualizar el estado del participante', 
      error: error.message 
    });
  }
};

// Función auxiliar para notificaciones (placeholder)
async function notifyUser(
  fromUserId: Types.ObjectId,
  toUserId: Types.ObjectId,
  type: string,
  message: string
): Promise<void> {
  // TODO: Implementar sistema de notificaciones
  console.log(`Notificación: De ${fromUserId} para ${toUserId} - ${type}: ${message}`);
}
