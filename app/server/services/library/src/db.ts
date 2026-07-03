import { BrollFootageMetadata } from '../../../models/broll-video-metadata';
import { PineconeRecord } from '@pinecone-database/pinecone';
import { PineconeVideoMetadata } from 'shared/types';

export const upsertMongo = async (match: PineconeRecord<PineconeVideoMetadata>) => {
  const exists = await BrollFootageMetadata.exists({ url: match.metadata?.url ?? match.id });

  if (exists === null) {
    const model = await new BrollFootageMetadata({
      ...match.metadata,
      url: match.metadata?.url ?? match.id
    }).save();

    return model._id?.toString() ?? '';
  } else {
    return exists._id?.toString() ?? '';
  }
};
