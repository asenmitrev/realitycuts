import Replicate from 'replicate';
import { REPLICATE_API_TOKEN } from '../../config/const';
import { logger } from '../logging';

if (!REPLICATE_API_TOKEN) {
  logger.warn('REPLICATE_API_TOKEN is not set');
}

export const replicateClient = new Replicate({
  auth: REPLICATE_API_TOKEN
});
