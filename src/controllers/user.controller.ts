import { Request, Response } from 'express';
import User from '../models/User';
import Plan from '../models/Plan';
import { UserError } from '../utils/errors';

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const updates = req.body;

    // Campos que no se pueden actualizar directamente
    const restrictedFields = ['password', 'email', 'googleId', 'facebookId'];
    restrictedFields.forEach(field => delete updates[field]);

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      throw new UserError('Usuario no encontrado');
    }

    res.json({
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        bio: updatedUser.bio,
        interests: updatedUser.interests,
        availability: updatedUser.availability,
        settings: updatedUser.settings,
      },
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(400).json({ message: error instanceof UserError ? error.message : 'Error al actualizar perfil' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { user } = req;
    const { settings } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: { settings } },
      { new: true }
    );

    if (!updatedUser) {
      throw new UserError('Usuario no encontrado');
    }

    res.json({ settings: updatedUser.settings });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(400).json({ message: error instanceof UserError ? error.message : 'Error al actualizar configuración' });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;

    const user = await User.findById(userId)
      .select('-password -googleId -facebookId')
      .populate('plansCreated', 'title description dateTime status')
      .populate('plansJoined', 'title description dateTime status');

    if (!user) {
      throw new UserError('Usuario no encontrado');
    }

    // Verificar configuración de privacidad
    if (!user.settings.privacy.publicProfile && 
        !requestingUser._id.equals(user._id) && 
        !user.friends.includes(requestingUser._id)) {
      return res.status(403).json({ message: 'Perfil privado' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(404).json({ message: error instanceof UserError ? error.message : 'Error al obtener perfil' });
  }
};

export const getUserPlans = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status, type } = req.query;

    const query: any = {};
    
    if (type === 'created') {
      query.creator = userId;
    } else if (type === 'joined') {
      query['participants.user'] = userId;
      query['participants.status'] = 'accepted';
    }

    if (status) {
      query.status = status;
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

export const addFriend = async (req: Request, res: Response) => {
  try {
    const { friendId } = req.params;
    const { user } = req;

    if (user._id.equals(friendId)) {
      throw new UserError('No puedes agregarte a ti mismo como amigo');
    }

    const friend = await User.findById(friendId);
    if (!friend) {
      throw new UserError('Usuario no encontrado');
    }

    if (user.friends.includes(friendId)) {
      throw new UserError('Ya son amigos');
    }

    await User.findByIdAndUpdate(
      user._id,
      { $push: { friends: friendId } }
    );

    await User.findByIdAndUpdate(
      friendId,
      { $push: { friends: user._id } }
    );

    res.json({ message: 'Amigo agregado correctamente' });
  } catch (error) {
    console.error('Error al agregar amigo:', error);
    res.status(400).json({ message: error instanceof UserError ? error.message : 'Error al agregar amigo' });
  }
};

export const removeFriend = async (req: Request, res: Response) => {
  try {
    const { friendId } = req.params;
    const { user } = req;

    await User.findByIdAndUpdate(
      user._id,
      { $pull: { friends: friendId } }
    );

    await User.findByIdAndUpdate(
      friendId,
      { $pull: { friends: user._id } }
    );

    res.json({ message: 'Amigo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar amigo:', error);
    res.status(500).json({ message: 'Error al eliminar amigo' });
  }
};
