import mongoose from 'mongoose';

const brandAssetSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: 'UserProfile', required: true, index: true },
    s3UploadId: { type: String, ref: 'S3Upload', required: true },
    name: { type: String },
    assetType: { type: String, enum: ['image', 'video', 'audio'] }
  },
  { timestamps: true }
);

brandAssetSchema.index({ userId: 1, createdAt: -1 });

export const BrandAsset = mongoose.model('BrandAsset', brandAssetSchema);
