import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      token?: string;
    }
  }
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new AuthError('Token no proporcionado');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AuthError('Usuario no encontrado');
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: 'Token inválido' });
    } else {
      console.error('Error de autenticación:', error);
      res.status(401).json({ message: 'No autorizado' });
    }
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await User.findById(decoded.userId);
      if (user) {
        req.token = token;
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // Si hay error en la autenticación, simplemente continuamos sin usuario
    next();
  }
};

export const checkRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthError('No autorizado');
      }

      const userRole = req.user.role;
      if (!roles.includes(userRole)) {
        throw new AuthError('No tienes permisos suficientes');
      }

      next();
    } catch (error) {
      console.error('Error de autorización:', error);
      res.status(403).json({ message: error instanceof AuthError ? error.message : 'No autorizado' });
    }
  };
};
