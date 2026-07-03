import { z } from 'zod';

// Params schemas
export const firebaseIdParamSchema = z.object({
  firebaseId: z.string().min(1)
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1, 'User ID is required')
});

// Body schemas
export const afterLoginBodySchema = z.object({
  firebaseId: z.string().min(1, 'Firebase ID is required'),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

export const afterRegBodySchema = z.object({
  firebaseId: z.string().min(1, 'Firebase ID is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  referralCode: z.string().optional()
});

export const waitlistBodySchema = z.object({
  email: z.string().email('Invalid email address')
});

