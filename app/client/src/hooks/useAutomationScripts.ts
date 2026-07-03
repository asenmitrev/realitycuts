import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApiService } from './useApiService';
import type { IAutomationScript } from '../types';
import { useUserId } from '../contexts/firebase/hooks';

export const useAutomationScripts = (configId?: string) => {
  const api = useApiService();
  return useQuery<IAutomationScript[]>({
    queryKey: ['automationScripts', configId],
    enabled: !!configId,
    queryFn: () => api.get<IAutomationScript[]>(`/api/automation-config/id/${configId}/scripts`)
  });
};

export const useUpdateAutomationScript = (configId?: string) => {
  const api = useApiService();
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ scriptId, topic, script }: { scriptId: string; topic?: string; script?: string }) => {
      return api.put<IAutomationScript, { topic?: string; script?: string }>(
        `/api/automation-config/id/${configId}/scripts/${scriptId}`,
        { topic, script }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries(['automationScripts', configId]);
      qc.invalidateQueries(['automationConfig', configId]);
      qc.invalidateQueries(['automationConfigs', userId]);
    }
  });
};

export const useDeleteAutomationScript = (configId?: string) => {
  const api = useApiService();
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (scriptId: string) => {
      await api.delete(`/api/automation-config/id/${configId}/scripts/${scriptId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries(['automationScripts', configId]);
      qc.invalidateQueries(['automationConfig', configId]);
      qc.invalidateQueries(['automationConfigs', userId]);
    }
  });
};

export const useDeleteAutomationScriptsBySource = (configId?: string) => {
  const api = useApiService();
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (uploadId: string) => {
      await api.delete(`/api/automation-config/id/${configId}/sources/${uploadId}/scripts`);
    },
    onSuccess: () => {
      qc.invalidateQueries(['automationScripts', configId]);
      qc.invalidateQueries(['automationConfig', configId]);
      qc.invalidateQueries(['automationConfigs', userId]);
    }
  });
};
