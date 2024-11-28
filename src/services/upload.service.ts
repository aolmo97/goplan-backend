import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import multer from 'multer';
import { Request } from 'express';
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

const initializeAzureStorage = async () => {
  if (!accountName || !accountKey) {
    throw new Error('Las credenciales de Azure Storage no están configuradas. Verifique las variables de entorno AZURE_STORAGE_ACCOUNT_NAME y AZURE_STORAGE_ACCOUNT_KEY');
  }

  try {
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
    throw new Error(`Error al inicializar Azure Blob Storage: ${error.message}`);
  }
};

// Asegurar que el directorio de uploads existe
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar almacenamiento temporal
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configurar multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 10 // máximo 10 archivos
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    console.log('Procesando archivo:', file);
    
    // Verificar tipo de archivo - más permisivo para React Native
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/*'  // Permitir cualquier tipo de imagen
    ];

    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      console.log('Archivo aceptado:', file.originalname);
      return cb(null, true);
    }
    console.log('Archivo rechazado:', file.originalname, file.mimetype);
    cb(new Error('Solo se permiten imágenes'));
  }
});

export const uploadImage = upload.single('image');
export const uploadImages = upload.array('photos', 10); // Permitir hasta 10 imágenes

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
  if (!containerClient) {
    throw new Error('Azure Blob Storage no está configurado correctamente');
  }

  try {
    const uploadPromises = files.map(async (file) => {
      const blobName = `${Date.now()}-${file.originalname}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      console.log(`Iniciando carga a Azure para ${file.originalname}...`);
      await blockBlobClient.uploadFile(file.path);
      console.log(`Archivo ${file.originalname} cargado exitosamente a Azure`);

      return blockBlobClient.url;
    });

    return await Promise.all(uploadPromises);
  } catch (error: any) {
    console.error('Error en uploadMultipleToAzure:', error);
    throw new Error(`Error al subir archivos a Azure: ${error.message}`);
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
