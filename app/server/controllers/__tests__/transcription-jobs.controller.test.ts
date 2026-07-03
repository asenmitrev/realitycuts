import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import transcriptionJobsController from '../transcription-jobs.controller';
import transcriptionJobService from '../../services/transcription-job.service';
import { BadRequestError } from '../../errors';

// Mock dependencies
vi.mock('../../services/transcription-job.service', () => ({
  default: {
    getJobs: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn()
  }
}));

describe('Transcription Jobs Controller', () => {
  let mockRequest: Partial<Omit<AuthenticatedRequest, 'user'>> & { user: Partial<AuthenticatedRequest['user']> };
  let mockResponse: Partial<Response>;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      user: { user_id: userId },
      params: {},
      body: {}
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
  });

  describe('get', () => {
    it('should return active transcription jobs for user', async () => {
      const mockJobs = [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'PROCESSING' }
      ];

      (transcriptionJobService.getJobs as Mock).mockResolvedValue(mockJobs);

      await transcriptionJobsController.get(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(transcriptionJobService.getJobs).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalledWith(mockJobs);
    });
  });

  describe('update', () => {
    const jobId = 'job-123';
    const updateData = { status: 'COMPLETED' };

    beforeEach(() => {
      mockRequest.params = { id: jobId };
      mockRequest.body = updateData;
    });

    it('should throw BadRequestError if no id provided', async () => {
      mockRequest.params = {};

      await expect(
        transcriptionJobsController.update(mockRequest as AuthenticatedRequest, mockResponse as Response)
      ).rejects.toThrow(BadRequestError);
    });

    it('should update job if authorized', async () => {
      const mockJob = { id: jobId, status: 'COMPLETED' };

      (transcriptionJobService.updateJob as Mock).mockResolvedValue(mockJob);

      await transcriptionJobsController.update(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(transcriptionJobService.updateJob).toHaveBeenCalledWith(jobId, userId, updateData);
      expect(mockResponse.json).toHaveBeenCalledWith(mockJob);
    });
  });

  describe('delete', () => {
    const jobId = 'job-123';

    beforeEach(() => {
      mockRequest.params = { id: jobId };
    });

    it('should delete job and return success', async () => {
      (transcriptionJobService.deleteJob as Mock).mockResolvedValue(undefined);

      await transcriptionJobsController.delete(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(transcriptionJobService.deleteJob).toHaveBeenCalledWith(jobId, userId);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
