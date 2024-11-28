import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError } from '../utils/errors';
import User, { IUser } from '../models/User';

// Extender la interfaz Request para incluir el usuario
export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AuthError('No se proporcionó token de autenticación');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AuthError('Formato de token inválido');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId)
      .select('-password')
      .exec();
    
    if (!user) {
      throw new AuthError('Usuario no encontrado');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthError('Token inválido'));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId)
      .select('-password')
      .exec();
    
    if (user) {
      req.user = user;
    }
    next();
  } catch (error) {
    // En auth opcional, si hay algún error simplemente continuamos sin usuario
    next();
  }
};

export const checkRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthError('No autorizado'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AuthError('No tienes permisos suficientes'));
    }

    next();
  };
};
