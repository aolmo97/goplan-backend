import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  sender: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'location';
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
}

export interface IChat extends Document {
  plan: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  messages: IMessage[];
  lastMessage?: IMessage;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'location'],
      default: 'text',
    },
    readBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  {
    timestamps: true,
  }
);

const chatSchema = new Schema<IChat>(
  {
    plan: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    messages: [messageSchema],
    lastMessage: messageSchema,
  },
  {
    timestamps: true,
  }
);

// Índices para mejorar el rendimiento
chatSchema.index({ plan: 1 });
chatSchema.index({ participants: 1 });
chatSchema.index({ 'messages.sender': 1 });
chatSchema.index({ updatedAt: -1 });

// Middleware para actualizar lastMessage
chatSchema.pre('save', function(next) {
  if (this.messages.length > 0) {
    this.lastMessage = this.messages[this.messages.length - 1];
  }
  next();
});

export default mongoose.model<IChat>('Chat', chatSchema);
