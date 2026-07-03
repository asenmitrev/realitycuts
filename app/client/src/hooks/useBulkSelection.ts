import { useState, useCallback } from 'react';
import { useApiService } from './useApiService';
import { useConfirmDialogV2 } from './useConfirmDialog';
import { VideoAlternative } from '../types';

export const useBulkSelection = (
  id: string | undefined,
  refetchBroll: () => void,
  setSearchResults: React.Dispatch<React.SetStateAction<VideoAlternative[]>>
) => {
  const apiService = useApiService();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const { dialogContent: bulkDeleteDialog, awaitConfirmation: awaitBulkDeleteConfirmation } = useConfirmDialogV2({
    title: `Delete ${selectedItems.size} Video${selectedItems.size !== 1 ? 's' : ''}`,
    type: 'delete'
  });

  const handleSelectionChange = useCallback((itemId: string, selected: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedItems.size === 0 || !id) return;

    try {
      setIsBulkDeleting(true);
      await awaitBulkDeleteConfirmation();

      await apiService.post<{ message: string }, { brollIds: string[] }>(`/api/library/${id}/broll/bulk-delete`, {
        brollIds: Array.from(selectedItems)
      });

      setSelectedItems(new Set());
      refetchBroll();
      setSearchResults(prev => prev.filter(item => !selectedItems.has(item._id ?? item.dbId ?? '')));
    } finally {
      setIsBulkDeleting(false);
    }
  }, [selectedItems, awaitBulkDeleteConfirmation, apiService, id, refetchBroll, setSearchResults]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  return {
    selectedItems,
    isBulkDeleting,
    handleSelectionChange,
    handleBulkDelete,
    clearSelection,
    bulkDeleteDialog
  };
};

