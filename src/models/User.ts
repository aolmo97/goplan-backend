import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUserSettings {
  notifications: {
    enabled: boolean;
    chatMessages: boolean;
    planUpdates: boolean;
    reminders: boolean;
  };
  privacy: {
    shareLocation: boolean;
    publicProfile: boolean;
  };
}

export interface IUser extends Document {
  id: string;
  email: string;
  password?: string;
  name: string;
  avatar?: string;
  photos: string[];  // Array de URLs de fotos
  bio?: string;
  googleId?: string;
  facebookId?: string;
  interests: string[];
  friends: mongoose.Types.ObjectId[];
  plansCreated: mongoose.Types.ObjectId[];
  plansJoined: mongoose.Types.ObjectId[];
  settings: IUserSettings;
  role: 'user' | 'admin';
  availability?: {
    days: string[];
    timeRanges: { start: string; end: string }[];
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: function(this: IUser) {
        return !this.googleId && !this.facebookId;
      },
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
    },
    photos: {
      type: [String],
      default: [],
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    googleId: String,
    facebookId: String,
    interests: [{
      type: String,
      trim: true,
    }],
    friends: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    plansCreated: [{
      type: Schema.Types.ObjectId,
      ref: 'Plan',
    }],
    plansJoined: [{
      type: Schema.Types.ObjectId,
      ref: 'Plan',
    }],
    settings: {
      notifications: {
        enabled: { type: Boolean, default: true },
        chatMessages: { type: Boolean, default: true },
        planUpdates: { type: Boolean, default: true },
        reminders: { type: Boolean, default: true },
      },
      privacy: {
        shareLocation: { type: Boolean, default: true },
        publicProfile: { type: Boolean, default: true },
      },
    },
    availability: {
      days: [String],
      timeRanges: [{
        start: String,
        end: String,
      }],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      }
    }
  }
);

// Índices
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ facebookId: 1 });
userSchema.index({ interests: 1 });

// Middleware pre-save para hashear la contraseña
userSchema.pre('save', async function(next) {
  const user = this;
  if (!user.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(user.password!, salt);
    user.password = hash;
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password!);
  } catch (error) {
    throw error;
  }
};

export default mongoose.model<IUser>('User', userSchema);
