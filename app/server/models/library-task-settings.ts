import mongoose from 'mongoose';
import { LibraryTaskSettings } from 'shared/types';
import './define-getters';
const libraryTaskSettingsSchema = new mongoose.Schema<LibraryTaskSettings>(
  {
    files: [
      {
        fileId: String,
        duration: Number,
        link: String
      }
    ]
  },
  { timestamps: true }
);

export const LibraryTaskSettingsModel = mongoose.model<LibraryTaskSettings>(
  'LibraryTaskSettings',
  libraryTaskSettingsSchema
);
