import { User } from '../models/user';

export interface UserDoc {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserRepository {
  async findByEmail(email: string): Promise<any | null> {
    return await User.findOne({ email: email.toLowerCase().trim() });
  }

  async findById(id: string): Promise<UserDoc | null> {
    const user = await User.findById(id);
    return user ? this.toPlainObject(user) : null;
  }

  async createWithPassword(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ): Promise<UserDoc | null> {
    const user = await User.createWithPassword(email, password, firstName, lastName);
    return this.toPlainObject(user);
  }

  async verifyCredentials(email: string, password: string): Promise<UserDoc | null> {
    const user = await User.verifyCredentials(email, password);
    return user ? this.toPlainObject(user) : null;
  }

  private toPlainObject(document: any): any {
    if (!document) return null;
    // Exclude sensitive fields
    const obj = document.toJSON ? document.toJSON() : document;
    const { passwordHash, salt, _id, ...safe } = obj;
    // Map MongoDB _id to id for frontend compatibility
    return { id: _id, ...safe };
  }
}

export default new UserRepository();
