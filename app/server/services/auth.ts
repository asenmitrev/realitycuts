import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserProfile } from '../models/user-profile';

const JWT_SECRET = process.env.JWT_SECRET ?? 'default-dev-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? JWT_SECRET;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 12);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function createAccessToken(userId: string, email?: string, role?: string): string {
  return jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: '15m' });
}

export function createRefreshToken(userId: string): string {
  return jwt.sign({ id: userId }, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): { id: string; email?: string; role?: string } {
  return jwt.verify(token, JWT_SECRET) as { id: string; email?: string; role?: string };
}

export function verifyRefreshToken(token: string): { id: string } {
  return jwt.verify(token, REFRESH_SECRET) as { id: string };
}

export async function getUserEmail(userId: string): Promise<string | undefined> {
  const profile = await UserProfile.findOne({ firebaseId: userId });
  return profile?.email;
}

export async function getUserIdFromEmail(email: string): Promise<string | undefined> {
  const profile = await UserProfile.findOne({ email });
  return profile?.firebaseId;
}
