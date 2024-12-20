import { Request, Response } from 'express';
import Chat from '../models/Chat';
import Plan from '../models/Plan';
import { ChatError } from '../utils/errors';

export const getChat = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { user } = req;

    const chat = await Chat.findOne({ plan: planId })
      .populate('participants', 'name avatar')
      .populate('messages.sender', 'name avatar');

    if (!chat) {
      throw new ChatError('Chat no encontrado');
    }

    // Verificar si el usuario es participante
    if (!chat.participants.some(p => p._id.equals(user?._id))) {
      throw new ChatError('No tienes acceso a este chat');
    }

    res.json({ chat });
  } catch (error) {
    console.error('Error al obtener chat:', error);
    res.status(404).json({ message: error instanceof ChatError ? error.message : 'Error al obtener chat' });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { user } = req;
    const { content, type = 'text' } = req.body;

    const chat = await Chat.findOne({ plan: planId });
    if (!chat) {
      throw new ChatError('Chat no encontrado');
    }

    // Verificar si el usuario es participante
    if (!chat.participants.some(p => p.equals(user?._id))) {
      throw new ChatError('No tienes acceso a este chat');
    }

    if (!user?._id) {
      throw new ChatError('Usuario no autenticado');
    }

    const message = {
      sender: user._id,
      content,
      type,
      readBy: [user._id],
      createdAt: new Date()
    };

    chat.messages.push(message);
    await chat.save();

    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name avatar')
      .populate('messages.sender', 'name avatar');

    res.json({ chat: populatedChat });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(400).json({ message: error instanceof ChatError ? error.message : 'Error al enviar mensaje' });
  }
};

export const markMessagesAsRead = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { user } = req;

    const chat = await Chat.findOne({ plan: planId });
    if (!chat) {
      throw new ChatError('Chat no encontrado');
    }

    // Verificar si el usuario es participante
    if (!chat.participants.some(p => p.equals(user?._id))) {
      throw new ChatError('No tienes acceso a este chat');
    }

    // Marcar como leídos los mensajes que no han sido leídos por el usuario
    const updates = chat.messages.map(message => {
      if (user?._id && !message.readBy.includes(user._id)) {
        message.readBy.push(user._id);
      } 
      return message;
    });

    chat.messages = updates;
    await chat.save();

    res.json({ message: 'Mensajes marcados como leídos' });
  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
    res.status(400).json({ message: error instanceof ChatError ? error.message : 'Error al marcar mensajes como leídos' });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { user } = req;

    const chat = await Chat.findOne({ plan: planId });
    if (!chat) {
      throw new ChatError('Chat no encontrado');
    }

    const unreadCount = chat.messages.filter(
      message => user?._id && !message.readBy.includes(user._id)
    ).length;

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error al obtener mensajes no leídos:', error);
    res.status(400).json({ message: error instanceof ChatError ? error.message : 'Error al obtener mensajes no leídos' });
  }
};
