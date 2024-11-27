import { Request, Response, NextFunction } from 'express';
import { AuthError, UserError, PlanError, ChatError } from '../utils/errors';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AuthError) {
    return res.status(401).json({
      error: 'AuthError',
      message: err.message
    });
  }

  if (err instanceof UserError) {
    return res.status(400).json({
      error: 'UserError',
      message: err.message
    });
  }

  if (err instanceof PlanError) {
    return res.status(400).json({
      error: 'PlanError',
      message: err.message
    });
  }

  if (err instanceof ChatError) {
    return res.status(400).json({
      error: 'ChatError',
      message: err.message
    });
  }

  // Error por defecto
  res.status(500).json({
    error: 'ServerError',
    message: 'Error interno del servidor'
  });
};
