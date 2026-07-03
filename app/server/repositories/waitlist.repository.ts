import { Waitlist } from '../models/waitlist';

export class WaitlistRepository {
  async findByEmail(email: string): Promise<any | null> {
    return Waitlist.findOne({ email: email.toLowerCase().trim() });
  }

  async create(email: string): Promise<any> {
    return Waitlist.create({ email });
  }

  async addToWaitlist(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const existingEntry = await this.findByEmail(email);

      if (existingEntry) {
        return {
          success: false,
          message: 'This email is already on the waitlist'
        };
      }

      await this.create(email);
      return {
        success: true,
        message: 'Successfully added to waitlist'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error adding to waitlist'
      };
    }
  }
}
