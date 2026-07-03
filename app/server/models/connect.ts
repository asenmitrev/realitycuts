import mongoose from 'mongoose';
import { MONGODB_URI } from '../config/const';
import { logger } from 'server/services/logging';
// Cache the connection promise to reuse across connection requests
let cachedConnection: Promise<typeof mongoose> | null = null;

export const connectMongo = async (useProdDb: boolean, maxPoolSize: number = 10, minPoolSize: number = 5) => {
  // Return cached connection if it exists and is connected
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  const connectionString = MONGODB_URI;
  if (!connectionString) {
    throw new Error('MONGODB_URI is not set');
  }

  // Create and cache the connection promise
  cachedConnection = mongoose.connect(connectionString, {
    maxPoolSize,
    minPoolSize,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  try {
    await cachedConnection;
    logger.info('Connected to MongoDB');
  } catch (error) {
    cachedConnection = null; // Reset cache on connection failure
    logger.error('Failed to connect to MongoDB', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }

  return connectionString;
};
