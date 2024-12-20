import StorageService from './storage';
import { API_CONFIG } from '../config';

interface PlanData {
  title: string;
  description: string;
  category: string;
  date: Date;
  time: Date;
  location: string;
  companionType: string;
  maxParticipants: string;
  isPublic: boolean;
  images: string[];
}

class PlanService {
  private static instance: PlanService;
  private readonly baseUrl: string;

  private constructor() {
    this.baseUrl = `${API_CONFIG.BASE_URL}/plans`;
  }

  public static getInstance(): PlanService {
    if (!PlanService.instance) {
      PlanService.instance = new PlanService();
    }
    return PlanService.instance;
  }

  // Función de utilidad para esperar
  private wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Función para subir fotos con reintentos
  private async uploadPhotosWithRetry(formData: FormData, token: string, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Intento ${attempt} de ${maxRetries}...`);
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/plans/photos`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Error al subir las fotos');
        }

        return await response.json();
      } catch (error) {
        console.log(`Error en intento ${attempt}:`, error);
        lastError = error;
        
        if (attempt < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await this.wait(waitTime);
        }
      }
    }
    
    throw lastError;
  }

  async createPlan(planData: PlanData): Promise<any> {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        throw new Error('No hay sesión activa');
      }

      // 1. Primero subir las imágenes si existen
      let photoUrls: string[] = [];
      if (planData.images && planData.images.length > 0) {
        const formData = new FormData();
        
        for (const photoUri of planData.images) {
          const timestamp = new Date().getTime();
          const randomString = Math.random().toString(36).substring(7);
          const filename = `plan_photo_${timestamp}_${randomString}.jpg`;

          // Crear el objeto del archivo
          const response = await fetch(photoUri);
          const blob = await response.blob();
          
          formData.append('photos', {
            uri: photoUri,
            type: 'image/jpeg',
            name: filename
          } as any);
        }

        const uploadResult = await this.uploadPhotosWithRetry(formData, token);
        photoUrls = uploadResult.photoUrls;
      }

      // 2. Crear el plan con las URLs de las fotos
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...planData,
          images: photoUrls
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al crear el plan');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en createPlan:', error);
      throw error;
    }
  }

  async getPlans(): Promise<any[]> {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(this.baseUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al obtener los planes');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en getPlans:', error);
      throw error;
    }
  }

  async getPlan(planId: string): Promise<any> {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(`${this.baseUrl}/${planId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al obtener el plan');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en getPlan:', error);
      throw error;
    }
  }
}

export default PlanService.getInstance();
