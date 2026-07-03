import jwt from 'jsonwebtoken';
import { UserRepository, UserDoc } from '../repositories/user.repository';
import userProfileRepository from '../repositories/user-profile.repository';
import { UnauthorizedError } from '../errors';
import { logger } from './logging';
import { User, hashPassword, verifyPassword } from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET ?? 'default-dev-secret';

export class UserAuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async register(email: string, password: string, firstName?: string, lastName?: string):
    Promise<{ user: UserDoc; token: string }> {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) throw new UnauthorizedError('An account with this email already exists.');
    const user = await this.userRepository.createWithPassword(email, password, firstName, lastName);
    if (!user) throw new Error('Failed to create user.');

    await this.ensureUserProfile(user.id, email, firstName, lastName);

    logger.info('New user registered', { email: user.email });
    const token = this.generateToken(user);
    return { user, token };
  }

  async login(email: string, password: string): Promise<{ user: UserDoc; token: string }> {
    const user = await this.userRepository.verifyCredentials(email, password);
    if (!user) throw new UnauthorizedError('Invalid email or password.');

    await this.ensureUserProfile(user.id, user.email);

    logger.info('User logged in', { email: user.email });
    const token = this.generateToken(user);
    return { user, token };
  }

  async getUserById(id: string): Promise<UserDoc | null> {
    return await this.userRepository.findById(id);
  }

  private async ensureUserProfile(userId: string, email: string, firstName?: string, lastName?: string): Promise<void> {
    const existing = await userProfileRepository.findByFirebaseId(userId);
    if (existing) return;
    await userProfileRepository.create({
      firebaseId: userId,
      email,
      firstName: firstName ?? '',
      lastName: lastName ?? '',
      role: 'user',
    });
    logger.info('UserProfile created from auth registration', { userId, email });
  }

  private generateToken(user: UserDoc): string {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' },
    );
  }

  async refreshToken(userId: string): Promise<string> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedError('User not found.');
    return this.generateToken(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new UnauthorizedError('User not found.');
    const isValid = await verifyPassword(currentPassword, user.salt, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Current password is incorrect.');
    const { passwordHash, salt } = await hashPassword(newPassword);
    await User.updateOne({ _id: userId }, { passwordHash, salt });
    logger.info('User changed password', { userId });
  }
}

export default new UserAuthService();
