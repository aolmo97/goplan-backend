import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

// Configuración de Azure Storage
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'goplan-uploads';

// Debug de variables de entorno
console.log('Variables de entorno Azure:');
console.log('AZURE_STORAGE_ACCOUNT_NAME:', process.env.AZURE_STORAGE_ACCOUNT_NAME);
console.log('AZURE_STORAGE_ACCOUNT_KEY:', process.env.AZURE_STORAGE_ACCOUNT_KEY ? '[PRESENTE]' : '[NO PRESENTE]');
console.log('AZURE_STORAGE_CONTAINER_NAME:', process.env.AZURE_STORAGE_CONTAINER_NAME);

// Validar configuración de Azure
if (!accountName || !accountKey) {
  console.warn('⚠️ Advertencia: Las credenciales de Azure Storage no están configuradas.');
  console.warn('Por favor, configure las siguientes variables de entorno:');
  console.warn('- AZURE_STORAGE_ACCOUNT_NAME');
  console.warn('- AZURE_STORAGE_ACCOUNT_KEY');
  console.warn('- AZURE_STORAGE_CONTAINER_NAME (opcional, por defecto: goplan-uploads)');
}

// Crear cliente de Azure Blob Storage
let blobServiceClient: BlobServiceClient | null = null;
let containerClient: any = null;
let initializationPromise: Promise<any> | null = null;

const initializeAzureStorage = async () => {
  if (!accountName || !accountKey) {
    throw new Error('Las credenciales de Azure Storage no están configuradas. Verifique las variables de entorno AZURE_STORAGE_ACCOUNT_NAME y AZURE_STORAGE_ACCOUNT_KEY');
  }

  if (containerClient) {
    return containerClient;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('Iniciando configuración de Azure Storage...');
      const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
      blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        sharedKeyCredential
      );
      containerClient = blobServiceClient.getContainerClient(containerName);
      
      // Verificar si el contenedor existe
      const exists = await containerClient.exists();
      if (!exists) {
        console.log('Contenedor no existe, creándolo...');
        await containerClient.create({
          access: 'container'
        });
        console.log('Contenedor creado exitosamente');
      } else {
        // Asegurar que el contenedor existente tenga acceso público
        await blobServiceClient.getContainerClient(containerName).setAccessPolicy('container');
        console.log('Acceso público configurado para el contenedor existente');
      }
      
      return containerClient;
    } catch (error: any) {
      console.error('Error al inicializar Azure Blob Storage:', error.message);
      containerClient = null;
      initializationPromise = null;
      throw new Error(`Error al inicializar Azure Blob Storage: ${error.message}`);
    }
  })();

  return initializationPromise;
};

// Asegurar que el directorio de uploads existe
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar multer base
const multerConfig = {
  storage: multer.memoryStorage(), // Usar almacenamiento en memoria en lugar de disco
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 10 // máximo 10 archivos
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    console.log('Procesando archivo:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Verificar el Content-Type de la solicitud
    const contentType = req.headers['content-type'] || '';
    console.log('Content-Type completo:', contentType);
    
    // Verificar que el Content-Type incluya el boundary
    if (!contentType.includes('multipart/form-data') || !contentType.includes('boundary=')) {
      console.log('Content-Type incorrecto o falta boundary:', contentType);
      cb(null, false);
      return;
    }
    
    // Aceptar cualquier tipo de imagen
    if (file.mimetype.startsWith('image/')) {
      console.log('Archivo aceptado:', file.originalname);
      cb(null, true);
    } else {
      console.log('Tipo de archivo no permitido:', file.mimetype);
      cb(null, false);
    }
  }
};

// Wrapper para manejar errores de multer
const wrapMulter = (uploadMiddleware: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log de headers antes de procesar
    console.log('Headers antes de multer:', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      allHeaders: req.headers
    });

    uploadMiddleware(req, res, (err: any) => {
      if (err) {
        console.error('Error en multer:', err);
        
        // Manejar diferentes tipos de errores
        if (err.message.includes('Boundary not found')) {
          return res.status(400).json({
            message: 'Error en el formato de la solicitud. El Content-Type debe incluir el boundary',
            error: err.message,
            help: 'Asegúrate de que el Content-Type sea similar a: multipart/form-data; boundary=----WebKitFormBoundaryXXXX',
            receivedContentType: req.headers['content-type']
          });
        }

        // Error genérico
        return res.status(400).json({
          message: 'Error al procesar los archivos',
          error: err.message,
          help: 'Verifica el formato y tamaño de los archivos'
        });
      }

      // Verificar si hay archivos después del procesamiento
      if (!req.file && !req.files) {
        return res.status(400).json({
          message: 'No se recibieron archivos o el tipo de archivo no es válido',
          help: 'Asegúrate de enviar imágenes en formato JPG, PNG, GIF o WebP'
        });
      }

      next();
    });
  };
};

// Crear instancias específicas para cada tipo de subida
const uploadSingle = multer(multerConfig).single('image');
const uploadMultiple = multer(multerConfig).array('photos', 10);

export const uploadImage = wrapMulter(uploadSingle);
export const uploadImages = wrapMulter(uploadMultiple);

export const uploadToAzure = async (file: Express.Multer.File): Promise<string> => {
  try {
    if (!containerClient) {
      containerClient = await initializeAzureStorage();
    }

    const blobName = `${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    console.log('Iniciando carga a Azure...');
    await blockBlobClient.uploadFile(file.path);
    console.log('Archivo cargado exitosamente a Azure');

    return blockBlobClient.url;
  } catch (error: any) {
    console.error('Error en uploadToAzure:', error);
    throw new Error(`Error al subir archivo a Azure: ${error.message}`);
  }
};

export const uploadMultipleToAzure = async (files: Express.Multer.File[]): Promise<string[]> => {
  try {
    // Asegurar que el cliente está inicializado antes de procesar cualquier archivo
    if (!containerClient) {
      console.log('Inicializando cliente de Azure...');
      await initializeAzureStorage();
      if (!containerClient) {
        throw new Error('No se pudo inicializar el cliente de Azure Storage');
      }
      console.log('Cliente de Azure inicializado correctamente');
    }

    console.log(`Iniciando subida de ${files.length} archivos a Azure`);
    
    const uploadPromises = files.map(async (file, index) => {
      // Usar timestamp + índice + random para evitar colisiones
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const blobName = `${timestamp}-${index}-${random}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      console.log(`Preparando subida de archivo: ${blobName}`);
      
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        console.log(`Iniciando subida de archivo: ${blobName}`);
        
        // Verificar que el buffer existe y tiene contenido
        if (!file.buffer || file.buffer.length === 0) {
          throw new Error(`El archivo ${blobName} está vacío o no tiene contenido`);
        }
        
        await blockBlobClient.upload(file.buffer, file.size);
        
        const url = blockBlobClient.url;
        console.log(`Archivo subido exitosamente: ${url}`);
        return url;
      } catch (error) {
        console.error(`Error al subir archivo ${blobName}:`, error);
        throw error;
      }
    });

    console.log('Esperando que todas las subidas se completen...');
    const urls = await Promise.all(uploadPromises);
    console.log('Todas las subidas completadas exitosamente');
    return urls;
  } catch (error) {
    console.error('Error al subir archivos a Azure:', error);
    throw error;
  }
};

export const deleteFromAzure = async (url: string): Promise<void> => {
  if (!containerClient) {
    throw new Error('Azure Blob Storage no está configurado correctamente');
  }

  try {
    const blobName = url.split('/').pop();
    if (!blobName) throw new Error('URL de blob inválida');
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.delete();
  } catch (error) {
    console.error('Error al eliminar archivo de Azure:', error);
    throw error;
  }
};
