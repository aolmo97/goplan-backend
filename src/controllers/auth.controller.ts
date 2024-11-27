import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthError } from '../utils/errors';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AuthError('El email ya está registrado');
    }

    // Crear nuevo usuario
    const user = new User({
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

    await user.save();

    // Generar token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(400).json({ message: error.message });
    } else {
      console.error('Error en registro:', error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const user = await User.findOne({ email });
    if (!user) {
      throw new AuthError('Credenciales inválidas');
    }

    // Verificar contraseña
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AuthError('Credenciales inválidas');
    }

    // Generar token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        settings: user.settings,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({ message: error.message });
    } else {
      console.error('Error en login:', error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  }
};

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { user } = req;
    if (!user) {
      throw new AuthError('No se pudo autenticar con Google');
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Error en autenticación Google:', error);
    res.status(500).json({ message: 'Error en la autenticación con Google' });
  }
};

export const facebookAuth = async (req: Request, res: Response) => {
  try {
    const { user } = req;
    if (!user) {
      throw new AuthError('No se pudo autenticar con Facebook');
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Error en autenticación Facebook:', error);
    res.status(500).json({ message: 'Error en la autenticación con Facebook' });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const { user } = req;
    if (!user) {
      throw new AuthError('Usuario no autenticado');
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(401).json({ message: 'No autorizado' });
  }
};
