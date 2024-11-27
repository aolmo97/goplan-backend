import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password?: string;
  name: string;
  avatar?: string;
  bio?: string;
  interests: string[];
  availability?: {
    days: string[];
    timeRanges: string[];
  };
  plansCreated: mongoose.Types.ObjectId[];
  plansJoined: mongoose.Types.ObjectId[];
  friends: mongoose.Types.ObjectId[];
  googleId?: string;
  facebookId?: string;
  settings: {
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
    avatar: String,
    bio: String,
    interests: [String],
    availability: {
      days: [String],
      timeRanges: [String],
    },
    plansCreated: [{
      type: Schema.Types.ObjectId,
      ref: 'Plan',
    }],
    plansJoined: [{
      type: Schema.Types.ObjectId,
      ref: 'Plan',
    }],
    friends: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    googleId: String,
    facebookId: String,
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
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password!, salt);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', userSchema);
