import express from 'express';
import { authenticateJWT } from '../middleware/auth-middleware';
import { configureDotenv } from '../config/dotenv';
import { asyncHandler } from '../utils/async-handler';
import { validateRequest } from '../middleware/validate-request';
import searchController from '../controllers/search.controller';
import {
  searchFootageBodySchema,
  autosuggestPublicLibrariesBodySchema
} from '../validations/search.validations';
import { connectMongo } from '../models/connect';

configureDotenv();

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongo(true);
    next();
  })
);

// Search for footage from different sources
router.post(
  '/footage',
  authenticateJWT,
  validateRequest({ body: searchFootageBodySchema }),
  asyncHandler(searchController.searchFootage)
);

// Suggest public libraries based on script context
router.post(
  '/autosuggest-public-libraries',
  authenticateJWT,
  validateRequest({ body: autosuggestPublicLibrariesBodySchema }),
  asyncHandler(searchController.autosuggestPublicLibraries)
);

export default router;
