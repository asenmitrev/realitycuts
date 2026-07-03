import { useRef, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Text,
  VStack,
  useToast
} from '@chakra-ui/react';
import { useFormContext } from 'react-hook-form';
import type { FC } from 'react';
import type { AutomationConfigFormData, IAutomationSource } from '../../types';
import { useApiService } from '../../hooks/useApiService';

interface Props {
  textColor: string;
}

export const AutomationPdfSourceSection: FC<Props> = ({ textColor }) => {
  const { watch, setValue } = useFormContext<AutomationConfigFormData>();
  const sources = watch('contentSettings.sources') ?? [];
  const activeSources = sources.filter(s => s.uploadId && !s.isDeleted);
  const [uploading, setUploading] = useState(false);
  const api = useApiService();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Invalid file', description: 'Please choose a PDF file.', status: 'error' });
      return;
    }
    setUploading(true);
    try {
      const { uploadId, presignedUrl } = await api.post<
        { uploadId: string; presignedUrl: string },
        { filename: string; contentType: string; size: number }
      >(`/api/upload/presigned`, {
        filename: file.name,
        contentType: file.type,
        size: file.size
      });

      await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      await api.post(`/api/upload/${uploadId}/confirm`, {});

      const entry: IAutomationSource = {
        uploadId,
        fileName: file.name,
        status: 'idle',
        isDeleted: false
      };
      setValue('contentSettings.sources', [...sources, entry], { shouldDirty: true });
      toast({ title: 'PDF uploaded', description: 'Save the automation to process the PDF.', status: 'success' });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Upload failed',
        description: e instanceof Error ? e.message : 'Could not upload PDF',
        status: 'error'
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = (uploadId?: string) => {
    if (!uploadId) return;
    setValue(
      'contentSettings.sources',
      sources.filter(source => source.uploadId !== uploadId),
      { shouldDirty: true }
    );
  };

  return (
    <FormControl>
      <FormLabel color={textColor}>Source material (PDF)</FormLabel>
      <FormHelperText color={textColor} opacity={0.85} mb={2}>
        Optional. Upload a PDF to generate scripts per page (processed after you save). The automation topic above
        filters which ideas are kept. When queued scripts run out, the usual topic-based generation continues.
      </FormHelperText>
      <Input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        display="none"
        onChange={e => void handleFile(e.target.files?.[0])}
      />
      <Button size="sm" onClick={() => inputRef.current?.click()} isLoading={uploading} isDisabled={uploading}>
        Choose PDF
      </Button>
      {activeSources.length > 0 ? (
        <VStack align="stretch" mt={3} spacing={3}>
          {activeSources.map(source => (
            <Box key={source.uploadId} borderWidth="1px" borderColor="whiteAlpha.300" borderRadius="md" p={3}>
              <Text color={textColor} fontWeight="medium">
                {source.fileName || 'PDF'}
              </Text>
              {source.status ? (
                <Text color={textColor} fontSize="sm" opacity={0.9}>
                  Status: {source.status}
                  {source.totalPages != null && source.totalPages > 0
                    ? ` — pages ${source.processedPages ?? 0}/${source.totalPages}`
                    : ''}
                  {source.scriptCount != null ? ` — ${source.scriptCount} script(s)` : ''}
                </Text>
              ) : null}
              {source.error ? (
                <Box color="red.300" fontSize="sm">
                  {source.error}
                </Box>
              ) : null}
              <Button size="xs" variant="outline" maxW="120px" mt={2} onClick={() => remove(source.uploadId)}>
                Remove PDF
              </Button>
            </Box>
          ))}
        </VStack>
      ) : null}
    </FormControl>
  );
};
