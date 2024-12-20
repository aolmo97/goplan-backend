import mongoose, { Document, Schema } from 'mongoose';

export interface IPlan extends Document {
  title: string;
  description: string;
  creator: mongoose.Types.ObjectId;
  category: string;
  location: {
    type: string;
    coordinates: number[];
    address?: string;
    city: string;
  };
  dateTime: Date;
  duration: number; // en minutos
  maxParticipants?: number;
  participants: {
    user: mongoose.Types.ObjectId;
    status: 'pending' | 'accepted' | 'rejected';
    joinedAt: Date;
  }[];
  tags: string[];
  privacy: 'public' | 'private' | 'friends';
  status: 'active' | 'cancelled' | 'completed';
  media: {
    type: 'image' | 'video';
    url: string;
  }[];
  chat: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: String,
      city: {
        type: String,
        required: true,
      },
    },
    dateTime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    maxParticipants: Number,
    participants: [{
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    tags: [String],
    privacy: {
      type: String,
      enum: ['public', 'private', 'friends'],
      default: 'public',
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'completed'],
      default: 'active',
    },
    media: {
      type: [{
        type: {
          type: String,
          enum: ['image', 'video'],
          required: true
        },
        url: {
          type: String,
          required: true
        }
      }],
      required: true,
      validate: {
        validator: function(media: any[]) {
          return media.length >= 1;
        },
        message: 'Al menos una imagen es requerida'
      }
    },
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
    },
  },
  {
    timestamps: true,
  }
);

// Índice geoespacial para búsquedas por ubicación
planSchema.index({ 'location.coordinates': '2dsphere' });

// Índices adicionales para mejorar el rendimiento de las búsquedas
planSchema.index({ creator: 1, status: 1 });
planSchema.index({ dateTime: 1 });
planSchema.index({ category: 1 });
planSchema.index({ tags: 1 });

export default mongoose.model<IPlan>('Plan', planSchema);
