import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { AuthError } from '../utils/errors';

// Extender Request para incluir el usuario tipado
interface AuthRequest extends Request {
  user?: IUser;
}

const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRATION || '24h' }
  );
};

const formatUserResponse = (user: IUser) => {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    bio: user.bio,
    interests: user.interests,
    availability: user.availability,
    settings: user.settings,
    photos: user.photos || [],
    friends: user.friends,
    plansCreated: user.plansCreated,
    plansJoined: user.plansJoined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, name } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
      throw new AuthError('El email ya está registrado');
    }

    // Crear nuevo usuario
    const user = await User.create({
      email,
      password,
      name,
      settings: {
        notifications: {
          enabled: true,
          chatMessages: true,
          planUpdates: true,
          reminders: true,
        },
        privacy: {
          shareLocation: true,
          publicProfile: true,
        },
      },
    });

    // Generar token
    const token = generateToken(user.id);

    // Enviar respuesta
    res.status(201).json({
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const user = await User.findOne({ email }).exec();
    if (!user) {
      throw new AuthError('Credenciales inválidas');
    }

    // Verificar contraseña
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AuthError('Credenciales inválidas');
    }

    // Generar token
    const token = generateToken(user.id);

    // Enviar respuesta
    res.json({
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthError('No se pudo autenticar con Google');
    }

    const token = generateToken(req.user.id);

    res.json({
      token,
      user: formatUserResponse(req.user),
    });
  } catch (error) {
    next(error);
  }
};

export const facebookAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthError('No se pudo autenticar con Facebook');
    }

    const token = generateToken(req.user.id);

    res.json({
      token,
      user: formatUserResponse(req.user),
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthError('No autorizado');
    }

    res.json({
      user: formatUserResponse(req.user),
    });
  } catch (error) {
    next(error);
  }
};
