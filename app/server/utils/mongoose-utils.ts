import mongoose from 'mongoose';

export function getObjectId(id: string) {
  return new mongoose.Types.ObjectId(id);
}
