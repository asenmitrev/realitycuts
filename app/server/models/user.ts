import mongoose from 'mongoose';
import crypto from 'crypto';
import { promisify } from 'util';

const pbkdf2 = promisify(crypto.pbkdf2);

const SALT_LENGTH = 16;
const ITERATIONS = 10000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export interface IUser {
  _id: string;
  email: string;
  passwordHash: string;
  salt: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    salt: {
      type: String,
      required: true
    },
    firstName: {
      type: String,
      default: ''
    },
    lastName: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      enum: ['editor', 'admin', 'user', 'pankeik'],
      default: 'user'
    }
  },
  { timestamps: true }
);

/**
 * Hash a password with a generated salt using PBKDF2.
 * Returns { passwordHash, salt } to store in the database.
 */
export async function hashPassword(password: string): Promise<{ passwordHash: string; salt: string }> {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return { passwordHash: hash.toString('hex'), salt };
}

/**
 * Verify a password against a stored hash + salt.
 */
export async function verifyPassword(
  password: string,
  storedSalt: string,
  storedHash: string
): Promise<boolean> {
  const hash = await pbkdf2(password, storedSalt, ITERATIONS, KEY_LENGTH, DIGEST);
  return hash.toString('hex') === storedHash;
}

userSchema.statics.createWithPassword = async function (
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<IUser> {
  const { passwordHash, salt } = await hashPassword(password);
  const user = new this({
    email,
    passwordHash,
    salt,
    firstName: firstName || '',
    lastName: lastName || ''
  });
  return await user.save();
};

userSchema.statics.verifyCredentials = async function (
  email: string,
  password: string
): Promise<IUser | null> {
  const user = await this.findOne({ email: email.toLowerCase().trim() });
  if (!user) return null;
  const isValid = await verifyPassword(password, user.salt, user.passwordHash);
  return isValid ? user : null;
};

export const User = mongoose.model('User', userSchema);
