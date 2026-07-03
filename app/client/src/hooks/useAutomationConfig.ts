import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useApiService } from './useApiService';
import { IAutomationConfig } from '../types';
import { useToast } from '@chakra-ui/react';
import { useUserId } from '../contexts/firebase/hooks';
import { ApiError } from '../service/apiService';

export const useAutomationConfigs = () => {
  const apiService = useApiService();
  const userId = useUserId();

  return useQuery<IAutomationConfig[]>({
    queryKey: ['automationConfigs', userId],
    enabled: !!userId,
    queryFn: async () => {
      return await apiService.get<IAutomationConfig[]>('/api/automation-config/user');
    }
  });
};

export const useAutomationConfig = (id?: string) => {
  const apiService = useApiService();

  return useQuery<IAutomationConfig>({
    queryKey: ['automationConfig', id],
    enabled: !!id,
    queryFn: async () => {
      return await apiService.get<IAutomationConfig>(`/api/automation-config/id/${id}`);
    }
  });
};

// Legacy hook for backward compatibility
export const useAutomationConfigByChannelId = (channelId?: string) => {
  const apiService = useApiService();

  return useQuery<IAutomationConfig>({
    queryKey: ['automationConfigByChannel', channelId],
    enabled: !!channelId,
    queryFn: async () => {
      return await apiService.get<IAutomationConfig>(`/api/automation-config/${channelId}`);
    }
  });
};

// New hook to get all automations for a channel
export const useAutomationConfigsByChannelId = (channelId?: string) => {
  const apiService = useApiService();

  return useQuery<IAutomationConfig[]>({
    queryKey: ['automationConfigsByChannel', channelId],
    enabled: !!channelId,
    queryFn: async () => {
      return await apiService.get<IAutomationConfig[]>(`/api/automation-config/channel/${channelId}/all`);
    }
  });
};

export const useCreateAutomationConfig = () => {
  const apiService = useApiService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = useUserId();

  return useMutation({
    mutationFn: async (data: Partial<IAutomationConfig>) => {
      return await apiService.post<IAutomationConfig, Partial<IAutomationConfig>>('/api/automation-config', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['automationConfigs', userId]);
      toast({
        title: 'Success',
        description: 'Automation created successfully!',
        status: 'success'
      });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        const errorData = error.data as { message?: string };
        const message = errorData?.message || error.message || 'Failed to create automation';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create automation',
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      }
    }
  });
};

export const useUpdateAutomationConfig = () => {
  const apiService = useApiService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = useUserId();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<IAutomationConfig> }) => {
      return await apiService.put<IAutomationConfig, Partial<IAutomationConfig>>(
        `/api/automation-config/id/${id}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['automationConfigs', userId]);
      queryClient.invalidateQueries(['automationConfig']);
      queryClient.invalidateQueries(['automationConfigsByChannel']);
      toast({
        title: 'Success',
        description: 'Automation updated successfully!',
        status: 'success'
      });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        const errorData = error.data as { message?: string };
        const message = errorData?.message || error.message || 'Failed to update automation';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update automation',
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      }
    }
  });
};

// Legacy hook for backward compatibility
export const useUpdateAutomationConfigByChannelId = () => {
  const apiService = useApiService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = useUserId();

  return useMutation({
    mutationFn: async ({ channelId, data }: { channelId: string; data: Partial<IAutomationConfig> }) => {
      return await apiService.put<IAutomationConfig, Partial<IAutomationConfig>>(
        `/api/automation-config/${channelId}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['automationConfigs', userId]);
      queryClient.invalidateQueries(['automationConfig']);
      queryClient.invalidateQueries(['automationConfigByChannel']);
      toast({
        title: 'Success',
        description: 'Automation updated successfully!',
        status: 'success'
      });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        const errorData = error.data as { message?: string };
        const message = errorData?.message || error.message || 'Failed to update automation';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update automation',
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      }
    }
  });
};

export const useDeleteAutomationConfig = () => {
  const apiService = useApiService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = useUserId();

  return useMutation({
    mutationFn: async (id: string) => {
      return await apiService.delete(`/api/automation-config/id/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['automationConfigs', userId]);
      queryClient.invalidateQueries(['automationConfigsByChannel']);
      toast({
        title: 'Success',
        description: 'Automation deleted successfully!',
        status: 'success'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete automation',
        status: 'error'
      });
    }
  });
};

// Legacy hook for backward compatibility
export const useDeleteAutomationConfigByChannelId = () => {
  const apiService = useApiService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = useUserId();

  return useMutation({
    mutationFn: async (channelId: string) => {
      return await apiService.delete(`/api/automation-config/${channelId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['automationConfigs', userId]);
      queryClient.invalidateQueries(['automationConfigByChannel']);
      toast({
        title: 'Success',
        description: 'Automation deleted successfully!',
        status: 'success'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete automation',
        status: 'error'
      });
    }
  });
};

export const useToggleAutomationConfig = () => {
  const apiService = useApiService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = useUserId();

  return useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      return await apiService.post<IAutomationConfig, { isEnabled: boolean }>(
        `/api/automation-config/id/${id}/toggle`,
        { isEnabled }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['automationConfigs', userId]);
      queryClient.invalidateQueries(['automationConfig']);
      queryClient.invalidateQueries(['automationConfigsByChannel']);
      toast({
        title: 'Success',
        description: 'Automation updated successfully!',
        status: 'success'
      });
    }
  });
};

// Legacy hook for backward compatibility
export const useToggleAutomationConfigByChannelId = () => {
  const apiService = useApiService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = useUserId();

  return useMutation({
    mutationFn: async ({ channelId, isEnabled }: { channelId: string; isEnabled: boolean }) => {
      return await apiService.post<IAutomationConfig, { isEnabled: boolean }>(
        `/api/automation-config/${channelId}/toggle`,
        { isEnabled }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['automationConfigs', userId]);
      queryClient.invalidateQueries(['automationConfig']);
      queryClient.invalidateQueries(['automationConfigByChannel']);
      toast({
        title: 'Success',
        description: 'Automation updated successfully!',
        status: 'success'
      });
    }
  });
};

export const useTestGeneration = () => {
  const apiService = useApiService();
  const toast = useToast();

  return useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      return await apiService.post('/api/automation-config/test/generation', params);
    },
    onSuccess: () => {
      toast({
        title: 'Test Started',
        description: 'Test video generation has been queued successfully!',
        status: 'success'
      });
    },
    onError: () => {
      toast({
        title: 'Test Failed',
        description: 'Failed to start test generation. Please try again.',
        status: 'error'
      });
    }
  });
};
