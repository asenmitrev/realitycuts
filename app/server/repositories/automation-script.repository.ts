import mongoose from 'mongoose';
import { AutomationScript } from '../models/automation-script';
import { IAutomationScript } from '../types';

class AutomationScriptRepository {
  async findNextAvailable(automationConfigId: string): Promise<IAutomationScript | null> {
    return AutomationScript.findOne({
      automationConfigId: new mongoose.Types.ObjectId(automationConfigId),
      status: 'available'
    })
      .sort({ order: 1 })
      .exec();
  }

  async findAvailableByAutomation(automationConfigId: string): Promise<IAutomationScript[]> {
    return AutomationScript.find({
      automationConfigId: new mongoose.Types.ObjectId(automationConfigId),
      status: 'available'
    })
      .sort({ order: 1 })
      .exec();
  }

  async findByAutomation(automationConfigId: string): Promise<IAutomationScript[]> {
    return AutomationScript.find({
      automationConfigId: new mongoose.Types.ObjectId(automationConfigId),
      status: { $ne: 'deleted' }
    })
      .sort({ order: 1 })
      .exec();
  }

  async findById(scriptId: string): Promise<IAutomationScript | null> {
    return AutomationScript.findById(scriptId).exec();
  }

  async getNextOrder(automationConfigId: string): Promise<number> {
    const last = await AutomationScript.findOne({
      automationConfigId: new mongoose.Types.ObjectId(automationConfigId)
    })
      .sort({ order: -1 })
      .select('order')
      .lean()
      .exec();
    return (last?.order ?? -1) + 1;
  }

  async createMany(
    docs: Array<{
      automationConfigId: mongoose.Types.ObjectId;
      userId: string;
      topic: string;
      script: string;
      sourceUploadId: mongoose.Types.ObjectId;
      sourcePageNumber: number;
      order: number;
    }>
  ): Promise<void> {
    if (docs.length === 0) return;
    await AutomationScript.insertMany(
      docs.map(d => ({
        ...d,
        status: 'available' as const
      }))
    );
  }

  async markAsUsed(scriptId: string): Promise<IAutomationScript | null> {
    return AutomationScript.findByIdAndUpdate(
      scriptId,
      { status: 'used', usedAt: new Date() },
      { new: true }
    ).exec();
  }

  async updateScript(
    scriptId: string,
    updates: Partial<Pick<IAutomationScript, 'topic' | 'script'>>
  ): Promise<IAutomationScript | null> {
    return AutomationScript.findByIdAndUpdate(scriptId, { $set: updates }, { new: true }).exec();
  }

  async softDelete(scriptId: string): Promise<IAutomationScript | null> {
    return AutomationScript.findByIdAndUpdate(
      scriptId,
      { status: 'deleted', deletedAt: new Date() },
      { new: true }
    ).exec();
  }

  async softDeleteBySource(sourceUploadId: string): Promise<number> {
    const res = await AutomationScript.updateMany(
      { sourceUploadId: new mongoose.Types.ObjectId(sourceUploadId), status: { $ne: 'deleted' } },
      { $set: { status: 'deleted', deletedAt: new Date() } }
    );
    return res.modifiedCount;
  }

  async softDeleteByAutomation(automationConfigId: string): Promise<number> {
    const res = await AutomationScript.updateMany(
      {
        automationConfigId: new mongoose.Types.ObjectId(automationConfigId),
        status: { $ne: 'deleted' }
      },
      { $set: { status: 'deleted', deletedAt: new Date() } }
    );
    return res.modifiedCount;
  }

  async softDeleteByAutomationAndSource(automationConfigId: string, sourceUploadId: string): Promise<number> {
    const res = await AutomationScript.updateMany(
      {
        automationConfigId: new mongoose.Types.ObjectId(automationConfigId),
        sourceUploadId: new mongoose.Types.ObjectId(sourceUploadId),
        status: { $ne: 'deleted' }
      },
      { $set: { status: 'deleted', deletedAt: new Date() } }
    );
    return res.modifiedCount;
  }

  async deleteManyBySourceAndPage(sourceUploadId: string, pageNumber: number): Promise<number> {
    const res = await AutomationScript.deleteMany({
      sourceUploadId: new mongoose.Types.ObjectId(sourceUploadId),
      sourcePageNumber: pageNumber
    });
    return res.deletedCount ?? 0;
  }
}

export default new AutomationScriptRepository();
