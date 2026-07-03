import mongoose from 'mongoose';
import { Model } from 'mongoose';
import './define-getters';
interface IWaitlist {
  email: string;
  signupDate: Date;
}

interface IWaitlistWithMethods extends IWaitlist {
  addToWaitlist: (email: string) => Promise<{ success: boolean; message: string }>;
}

const waitlistSchema = new mongoose.Schema<IWaitlist, Model<IWaitlist>, IWaitlistWithMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    signupDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Static method to safely add email to waitlist
waitlistSchema.statics.addToWaitlist = async function (email: string): Promise<{ success: boolean; message: string }> {
  try {
    const existingEntry = await this.findOne({ email: email.toLowerCase().trim() });

    if (existingEntry) {
      return {
        success: false,
        message: 'This email is already on the waitlist'
      };
    }

    await this.create({ email });
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
};

export const Waitlist = mongoose.model('Waitlist', waitlistSchema);
