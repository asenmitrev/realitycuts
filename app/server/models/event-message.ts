import mongoose from 'mongoose';
import { IEventMessage } from '../types';

import './define-getters';
const eventMessageSchema = new mongoose.Schema<IEventMessage>(
  {
    userId: {
      type: String,
      index: true
    },
    eventId: {
      type: String,
      index: true
    },
    eventType: {
      type: String,
      enum: ['MESSAGE', 'DATA']
    },
    message: String,
    isError: Boolean,
    progress: Number,
    data: mongoose.Schema.Types.Mixed,
    expireAt: {
      type: Date,
      index: { expires: '12d' },
      default: function (this: IEventMessage) {
        return this.isError === true ? null : new Date();
      }
    }
  },
  { timestamps: true }
);

export const EventMessageModel = mongoose.model<IEventMessage>('EventMessage', eventMessageSchema);
