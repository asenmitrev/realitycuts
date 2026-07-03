import { Survey } from '../models/survey';
import { ISurvey } from '../types';

export class SurveyRepository {
  async findByUserId(userId: string): Promise<ISurvey | null> {
    const survey = await Survey.findOne({ userId });
    return survey ? this.toPlainObject(survey) : null;
  }

  async create(surveyData: Omit<ISurvey, 'createdAt' | 'updatedAt'>): Promise<ISurvey> {
    const newSurvey = new Survey(surveyData);
    const savedSurvey = await newSurvey.save();
    return this.toPlainObject(savedSurvey);
  }

  async updateByUserId(userId: string, updateData: Partial<ISurvey>): Promise<ISurvey | null> {
    const updatedSurvey = await Survey.findOneAndUpdate({ userId }, { $set: updateData }, { new: true });
    return updatedSurvey ? this.toPlainObject(updatedSurvey) : null;
  }

  async existsByUserId(userId: string): Promise<boolean> {
    const count = await Survey.countDocuments({ userId });
    return count > 0;
  }

  /**
   * Get all surveys with pagination (for admin use only)
   * ONLY TO BE USED IN UAT ENVIRONMENT
   */
  async getAllSurveysWithPagination(
    skip: number = 0,
    limit: number = 50
  ): Promise<{ surveys: ISurvey[]; total: number }> {
    const [surveys, total] = await Promise.all([
      Survey.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Survey.countDocuments({})
    ]);

    return {
      surveys: surveys.map(survey => this.toPlainObject(survey)),
      total
    };
  }

  /**
   * Converts a Mongoose document to a plain JavaScript object
   */
  private toPlainObject(document: any): any {
    if (!document) return null;
    return document.toJSON ? document.toJSON() : document;
  }
}

export default new SurveyRepository();
