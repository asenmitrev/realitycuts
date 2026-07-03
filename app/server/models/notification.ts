import mongoose from 'mongoose';
import { INotification } from '../types';
import './define-getters';
const notificationSchema = new mongoose.Schema<INotification>(
  {
    userId: String,
    type: {
      type: String,
      enum: [
        'EXPORT_COMPLETE',
        'VIDEO_COMPLETE',
        'LIBRARY_POPULATED',
        'AUTOMATION_FAILED'
      ]
    },
    title: String,
    message: String,
    isRead: { type: Boolean, default: false },
    links: [
      {
        text: String,
        url: String,
        linkType: { type: String, enum: ['EXPORT', 'VIDEO', 'LIBRARY', 'EXTERNAL'] },
        docId: String
      }
    ]
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);
