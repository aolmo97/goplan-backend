import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import Plan from '../models/Plan';
import { UserError } from '../utils/errors';
import { deleteFromAzure, uploadToAzure, uploadMultipleToAzure } from '../services/upload.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    const updates = req.body;

    // Campos que no se pueden actualizar directamente
    const restrictedFields = ['password', 'email', 'googleId', 'facebookId'];
    restrictedFields.forEach(field => delete updates[field]);

    const updatedUser = await User.findByIdAndUpdate(
      user.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json({
      user: {
        id: updatedUser.id,
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

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    const { settings } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      user.id,
      { $set: { settings } },
      { new: true }
    );

    if (!updatedUser) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json({ settings: updatedUser.settings });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(400).json({ message: error instanceof UserError ? error.message : 'Error al actualizar configuración' });
  }
};

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user as IUser | undefined;

    const user = await User.findById(userId)
      .select('-password -googleId -facebookId')
      .populate('plansCreated', 'title description dateTime status')
      .populate('plansJoined', 'title description dateTime status');

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Verificar configuración de privacidad
    if (!user.settings?.privacy?.publicProfile && 
        requestingUser && 
        requestingUser.id !== user.id && 
        !user.friends.includes(new mongoose.Types.ObjectId(requestingUser.id))) {
      res.status(403).json({ message: 'Perfil privado' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ 
      message: error instanceof UserError ? error.message : 'Error al obtener perfil' 
    });
  }
};

export const getUserPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user as IUser | undefined;

    const user = await User.findById(userId)
      .populate('plansCreated')
      .populate('plansJoined');

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Verificar privacidad
    if (!user.settings.privacy.publicProfile && 
        requestingUser && 
        requestingUser.id !== user.id && 
        !user.friends.includes(new mongoose.Types.ObjectId(requestingUser.id))) {
      res.status(403).json({ message: 'Perfil privado' });
      return;
    }

    const plans = {
      created: user.plansCreated,
      joined: user.plansJoined,
    };

    res.json({ plans });
  } catch (error) {
    console.error('Error al obtener planes:', error);
    res.status(500).json({ message: 'Error al obtener planes del usuario' });
  }
};

export const addFriend = async (req: Request, res: Response): Promise<void> => {
  try {
    const { friendId } = req.params;
    const user = req.user as IUser;

    if (user.id === friendId) {
      res.status(400).json({ message: 'No puedes agregarte a ti mismo como amigo' });
      return;
    }

    const friend = await User.findById(friendId);
    if (!friend) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    if (user.friends.includes(new mongoose.Types.ObjectId(friendId))) {
      res.status(400).json({ message: 'Ya son amigos' });
      return;
    }

    await User.findByIdAndUpdate(
      user.id,
      { $push: { friends: friendId } }
    );

    await User.findByIdAndUpdate(
      friendId,
      { $push: { friends: user.id } }
    );

    res.json({ message: 'Amigo agregado correctamente' });
  } catch (error) {
    console.error('Error al agregar amigo:', error);
    res.status(500).json({ message: 'Error al agregar amigo' });
  }
};

export const removeFriend = async (req: Request, res: Response): Promise<void> => {
  try {
    const { friendId } = req.params;
    const user = req.user as IUser;

    await User.findByIdAndUpdate(
      user.id,
      { $pull: { friends: friendId } }
    );

    await User.findByIdAndUpdate(
      friendId,
      { $pull: { friends: user.id } }
    );

    res.json({ message: 'Amigo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar amigo:', error);
    res.status(500).json({ message: 'Error al eliminar amigo' });
  }
};

export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as IUser;
    
    if (!req.file) {
      res.status(400).json({ message: 'No se ha proporcionado ninguna imagen' });
      return;
    }

    // Si el usuario ya tiene un avatar, eliminar el anterior
    if (user.avatar) {
      try {
        await deleteFromAzure(user.avatar);
      } catch (error) {
        console.error('Error al eliminar avatar anterior:', error);
      }
    }

    // Subir nueva imagen a Azure
    const imageUrl = await uploadToAzure(req.file);

    // Actualizar el avatar del usuario
    const updatedUser = await User.findByIdAndUpdate(
      user.id,
      { $set: { avatar: imageUrl } },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json({ 
      message: 'Avatar actualizado correctamente',
      user: updatedUser 
    });
  } catch (error) {
    console.error('Error al subir avatar:', error);
    res.status(500).json({ message: 'Error al subir el avatar' });
  }
};

export const uploadPhotos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('Request files:', req.files);
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      console.log('No se detectaron archivos en la solicitud');
      res.status(400).json({ message: 'No se han proporcionado imágenes' });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    // Subir las imágenes a Azure
    console.log('Iniciando subida a Azure de', files.length, 'archivos');
    const photoUrls = await uploadMultipleToAzure(files);
    console.log('URLs de fotos obtenidas:', photoUrls);

    // Actualizar el usuario con las nuevas fotos
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Agregar las nuevas fotos al array existente
    user.photos = [...(user.photos || []), ...photoUrls];
    await user.save();
    console.log('Usuario actualizado con nuevas fotos');

    res.status(200).json({
      message: 'Fotos subidas correctamente',
      user
    });
  } catch (error) {
    console.error('Error al subir fotos:', error);
    res.status(500).json({ message: 'Error al subir las fotos', error: (error as Error).message });
  }
};

export const deletePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { photoUrl } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Eliminar la foto de Azure
    await deleteFromAzure(photoUrl);

    // Eliminar la URL de la foto del array de fotos del usuario
    user.photos = user.photos.filter(url => url !== photoUrl);
    await user.save();

    res.status(200).json({
      message: 'Foto eliminada correctamente',
      user
    });
  } catch (error) {
    console.error('Error al eliminar foto:', error);
    res.status(500).json({ message: 'Error al eliminar la foto', error: (error as Error).message });
  }
};
