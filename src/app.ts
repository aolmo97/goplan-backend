import express from 'express';
import cors from 'cors';
import passport from 'passport';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Middleware
app.use(cors({
  origin: '*',  // Permitir todas las origenes en desarrollo
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Middleware para manejar preflight requests
app.options('*', cors());

// Configurar middleware para rutas específicas
app.use((req, res, next) => {
  // Agregar headers adicionales para Expo
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // No procesar el body para rutas de subida de archivos
  if (req.path.includes('/api/user/photos') || req.path.includes('/api/user/avatar')) {
    // Log para depuración
    console.log('Headers de la solicitud:', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });
    return next();
  }
  
  // Para otras rutas, usar el parser JSON
  express.json()(req, res, next);
});

// Configurar el parser de URL-encoded después del middleware personalizado
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(passport.initialize());

// Configure passport strategies
require('./config/passport');

// Routes
app.use('/api', routes);

// Error handling middleware (debe ir después de las rutas)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  errorHandler(err, req, res, next);
});

export default app;
