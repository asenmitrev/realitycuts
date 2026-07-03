import mongoose, { Document, Schema } from 'mongoose';

export interface IPreUserPrompt extends Document {
  token: string;
  prompt: string;
  libraryIds?: string; // comma-separated library IDs
  libraryName?: string; // LLM-generated library name
  createdAt: Date;
}

const PreUserPromptSchema = new Schema<IPreUserPrompt>({
  token: { type: String, required: true, unique: true },
  prompt: { type: String, required: true },
  libraryIds: { type: String, required: false }, // comma-separated library IDs
  libraryName: { type: String, required: false }, // LLM-generated library name
  createdAt: { type: Date, default: Date.now } // expires in 1 hour
});

export default mongoose.model<IPreUserPrompt>('PreUserPrompt', PreUserPromptSchema);
