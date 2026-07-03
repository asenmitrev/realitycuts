import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { getObjectId } from '../mongoose-utils';

describe('getObjectId', () => {
  it('should create a valid ObjectId from a string', () => {
    const idString = '507f1f77bcf86cd799439011';
    const objectId = getObjectId(idString);

    expect(objectId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(objectId.toString()).toBe(idString);
  });

  it('should create a new ObjectId for a valid hex string', () => {
    const idString = '507f191e810c19729de860ea';
    const objectId = getObjectId(idString);

    expect(mongoose.Types.ObjectId.isValid(objectId)).toBe(true);
    expect(objectId.toString()).toBe(idString);
  });

  it('should handle 24-character hex strings', () => {
    const idString = '000000000000000000000000';
    const objectId = getObjectId(idString);

    expect(objectId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(objectId.toString()).toBe(idString);
  });
});
