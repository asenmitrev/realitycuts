import { FC, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast
} from '@chakra-ui/react';
import { IHighlightData, IHighlightInstance, WordBaseEdited, EditedTranscript, ExportJob } from '../../types';
import { useApiService } from '../../hooks/useApiService';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { useHighlightEditorReducer } from '../../hooks/useHighlightEditorReducer';
import { HighlightEditor } from './HighlightEditor';
import { useQuery, useQueryClient } from 'react-query';
import { useMessages } from '../../hooks/useMessages';
import { FaChevronLeft, FaChevronRight, FaEdit, FaSave, FaTrash } from 'react-icons/fa';
import { PopulatedVideoAIData, Video } from '../video-editor/Video';
import { ProgressReport } from '../common/ProgressReport';
import { ExportCard } from '../export/ExportList';
import { useEditedWords } from '../../hooks/useEditedWords';

export const Highlight: FC<{
  data: IHighlightData;
  highlight: IHighlightInstance;
  broll: PopulatedVideoAIData;
  onSave: (editedWords: WordBaseEdited[], startIndex: number, endIndex: number) => void;
  onDelete: (hl: IHighlightInstance) => void;
  refetchData: () => void;
  onAcceptedForEditingSuccess: (isAcceptedForEditing: boolean, hlId: string) => void;
}> = ({ data, broll, highlight, refetchData, onSave, onDelete, onAcceptedForEditingSuccess }) => {
  const videoPlayerRef = useRef<{ save: () => void; onStartExport: () => void }>(null);
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingAcceptedForEditing, setIsLoadingAcceptedForEditing] = useState(false);
  const [isAcceptedForEditing, setisAcceptedForEditing] = useState(highlight.isAcceptedForEditing);
  const [isGeneratingBroll, setIsGeneratingBroll] = useState<boolean>(false);
  const apiService = useApiService();
  const [eventId, setEventId] = useState<string>(urlSearchParams.get('eventId') ?? '');

  const [speakerMap, setSpeakerMap] = useState<Record<number, string>>(data.speakerMap ?? {});
  const [isGeneratingRecropData, setIsGeneratingRecropData] = useState(false);
  const serverData = useMessages(eventId ?? '', 'DATA');
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);
  const wordList = highlight.editedWordsList;
  const tabIndexUrlParam = parseInt(urlSearchParams.get('tabIndex') ?? '0');
  const eventIdUrlParam = urlSearchParams.get('eventId');
  const [tabIndex, setTabIndex] = useState(tabIndexUrlParam);
  const [showMoreExports, setShowMoreExports] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState<string>();
  const [isSavingVideoTitle, setIsSavingVideoTitle] = useState(false);
  const [editorState, editorDispatch] = useHighlightEditorReducer({
    transcript: wordList
  });

  const { data: exports, refetch: refetchExports } = useQuery({
    queryKey: ['exportspervideo', broll._id],
    enabled: !!broll._id,
    queryFn: async () => {
      return await apiService.get<ExportJob[]>(`/api/exports?id=${broll._id}`);
    }
  });

  const navigate = useNavigate();

  useEffect(() => {
    setTabIndex(tabIndexUrlParam);
  }, [tabIndexUrlParam]);
  useEffect(() => {
    if (eventIdUrlParam) {
      setEventId(eventIdUrlParam);
    }
  }, [eventIdUrlParam]);

  useEffect(() => {
    editorDispatch({
      type: 'RESET',
      payload: {
        transcript: wordList
      }
    });
  }, [highlight, wordList, editorDispatch]);

  useEffect(() => {
    if (!serverData) return;
    for (const datum of serverData) {
      let tabIndex = 0;
      if (datum.data?.isBroll || datum.data?.isRecrop) {
        tabIndex = 0;
      } else if (datum.data?.isExport) {
        tabIndex = 1;
        refetchExports();
      }
      setEventId('');
      setUrlSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('eventId', '');
        next.set('tabIndex', `${tabIndex}`);
        return next;
      });
      refetchData();
      setIsGeneratingBroll(false);
      setIsGeneratingRecropData(false);
    }
  }, [serverData, refetchExports, setUrlSearchParams, navigate, refetchData, eventId]);

  const onChangeSpeakerMap = async (speakerNumber: number, speakerName: string) => {
    try {
      await apiService.post(`/api/highlights/${data._id}/speaker-map`, { ...speakerMap, [speakerNumber]: speakerName });
      setSpeakerMap(v => ({
        ...v,
        [speakerNumber]: speakerName
      }));
    } catch {
      console.error('Error saving speaker map');
    }
  };
  const onAcceptForEditing = async (isEnabled?: boolean) => {
    if (isEnabled === isAcceptedForEditing) {
      return;
    }
    const newValue = isEnabled !== undefined ? isEnabled : !isAcceptedForEditing;
    if (newValue) {
      // generateBrollForPreview();
      onGenerateVertical();
    }
    try {
      setIsLoadingAcceptedForEditing(true);
      await apiService.post<{ success: boolean }, { isAcceptedForEditing: boolean }>(
        `/api/highlights/${data._id}/${highlight._id}/accept-for-editing`,
        { isAcceptedForEditing: newValue }
      );
      setisAcceptedForEditing(!isAcceptedForEditing);
      onAcceptedForEditingSuccess(!isAcceptedForEditing, highlight._id);
    } finally {
      setIsLoadingAcceptedForEditing(false);
    }
  };

  const onDeleteClick = async () => {
    try {
      setIsDeleting(true);
      await apiService.delete(`/api/highlights/${data._id}/${highlight._id}`);
      onDelete(highlight);
    } finally {
      setIsDeleting(false);
    }
  };

  const startEvent = (eventId: string) => {
    setEventId(eventId);
    setUrlSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('eventId', eventId);
      return next;
    });
    // setTabIndex(3);
  };
  const onGenerateNew = async () => {
    if (!data) return;

    setIsGeneratingNew(true);
    try {
      const { eventId } = await apiService.post<{ eventId: string }>(`/api/highlights/${data._id}/generate`);
      navigate(`/upload-progress/${eventId}`);
    } finally {
      setIsGeneratingNew(false);
    }
  };

  const editedWords = useEditedWords(highlight.editedWordsList ?? [], editorState);

  const onSubmitReview = async (exportId: string) => {
    await apiService.post(`/api/exports/${exportId}/submit-for-review`);
    await refetchExports();
    setTabIndex(2);
    setUrlSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tabIndex', '2');
      return next;
    });
  };

  const onRetranscribe = async (wordIds: number[]) => {
    let startTime = Number.POSITIVE_INFINITY;
    let endTime = 0;
    for (const word of editedWords) {
      if (wordIds.indexOf(word.wordIndex ?? -100) !== -1) {
        if (startTime > word.start) {
          startTime = word.start;
        }
        if (endTime < word.end) {
          endTime = word.end;
        }
      }
    }

    const result = await apiService.post<WordBaseEdited[], { startTime: number; endTime: number }>(
      `/api/highlights/${data._id}/${highlight._id}/retranscribe`,
      {
        startTime,
        endTime
      }
    );

    editorDispatch({ type: 'REPLACE_WORDS', payload: { startTime, endTime, words: result, transcript: editedWords } });
  };

  const onSaveClick = async () => {
    setIsSaving(true);
    await Promise.resolve();

    await videoPlayerRef.current?.save();
    await onSave(editedWords, editorState.startIndex, editorState.endIndex);
    setIsSaving(false);
  };

  const editVideo = async () => {
    setIsSavingVideoTitle(true);
    try {
      await apiService.put(`/api/highlights/${data._id}/${highlight._id}/title`, { title: editedTitle });
      await refetchData();
      setIsEditingTitle(false);
    } finally {
      setIsSavingVideoTitle(false);
    }
  };

  const onSaveProgrammatic = async () => {
    await onSave(editedWords, editorState.startIndex, editorState.endIndex);
  };

  const onGenerateVertical = async () => {
    if ((broll.croppedInfo && broll.croppedInfo.length > 0) || isGeneratingRecropData) {
      return;
    }
    setIsGeneratingRecropData(true);
    const { eventId } = await apiService.post<{ eventId: string }>(
      `/api/highlights/${data._id}/${highlight._id}/vertical`
    );
    startEvent(eventId);
  };

  const generateBrollForPreview = async () => {
    if (broll.segments.length > 0 || isGeneratingBroll) {
      return;
    }
    setIsGeneratingBroll(true);
    await onSaveClick();
    const { eventId } = await apiService.post<
      { eventId: string },
      {
        includeMusic: boolean;
      }
    >(`/api/highlights/${data._id}/${highlight._id}/b-roll`, { includeMusic: true });

    startEvent(eventId);
  };

  const currentHighlightIndex = useMemo(() => {
    const currentHighlight = data.highlights.findIndex(hl => hl._id === highlight._id);
    return currentHighlight;
  }, [data, highlight._id]);

  const navigatePrev = () => {
    if (currentHighlightIndex > 0) {
      navigate(`/highlight/${data._id}/${data.highlights[currentHighlightIndex - 1]._id}`);
    }
  };

  const navigateNext = () => {
    if (currentHighlightIndex + 1 < data.highlights.length) {
      navigate(`/highlight/${data._id}/${data.highlights[currentHighlightIndex + 1]._id}`);
    }
  };

  return (
    <>
      <Heading
        px={8}
        py={10}
        display="flex"
        gap={4}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="nowrap"
      >
        {!isEditingTitle ? (
          <Box
            textOverflow="ellipsis"
            overflow="hidden"
            whiteSpace="nowrap"
            display="flex"
            flexWrap="nowrap"
            alignItems="center"
            gap={4}
          >
            {currentHighlightIndex > 0 ? (
              <Button variant="ghost" size="sm" fontSize="large" onClick={navigatePrev}>
                <FaChevronLeft />
              </Button>
            ) : null}
            {currentHighlightIndex + 1 < data.highlights.length ? (
              <Button variant="ghost" size="sm" fontSize="large" onClick={navigateNext}>
                <FaChevronRight />
              </Button>
            ) : null}
            {highlight.title ?? 'Highlight Instance'}
            <FaEdit size={18} onClick={() => setIsEditingTitle(true)} />
          </Box>
        ) : (
          <Flex gap={3} alignItems="center" flexGrow="1" maxW="50%">
            <Input onChange={e => setEditedTitle(e.target.value)} value={editedTitle ?? highlight.title} />
            <Button colorScheme="white" variant="ghost" size="sm" fontSize="larger" isLoading={isSavingVideoTitle}>
              <FaSave size={24} onClick={() => editVideo()} />
            </Button>
          </Flex>
        )}
        <Flex gap={4}>
          <Button
            colorScheme="blue"
            variant="outline"
            onClick={() => onGenerateNew()}
            isLoading={isGeneratingNew}
            isDisabled={isGeneratingNew}
          >
            Find Another Segment
          </Button>
          <Button
            colorScheme={isAcceptedForEditing ? 'red' : 'green'}
            variant="outline"
            onClick={() => onAcceptForEditing()}
            isLoading={isLoadingAcceptedForEditing}
            isDisabled={isLoadingAcceptedForEditing}
          >
            {isAcceptedForEditing ? 'Stop Edit' : 'Start Edit'}
          </Button>
          <Button
            colorScheme="red"
            variant="solid"
            onClick={onDeleteClick}
            isLoading={isDeleting}
            isDisabled={isDeleting}
          >
            <FaTrash />
          </Button>
          <Button colorScheme="blue" variant="solid" onClick={onSaveClick} isLoading={isSaving} isDisabled={isSaving}>
            <FaSave />
          </Button>
        </Flex>
      </Heading>

      <Flex gap={6}>
        <Box width={{ base: '100%', md: '40%' }} px={8}>
          <Tabs
            index={tabIndex}
            onChange={index => {
              setTabIndex(index);
              setUrlSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('tabIndex', `${index}`);
                return next;
              });
            }}
          >
            <TabList>
              <Tab>Transcript</Tab>
              <Tab>Exports</Tab>
              <Tab color={undefined}>Review History</Tab>
              {eventId && <Tab>Progress report</Tab>}
            </TabList>

            <TabPanels>
              <TabPanel px={0}>
                <HighlightEditor
                  onRetranscribe={onRetranscribe}
                  isEnabled={isAcceptedForEditing}
                  speakerMap={speakerMap}
                  onChangeSpeakerMap={onChangeSpeakerMap}
                  onAcceptForEditing={onAcceptForEditing}
                  editorDispatch={editorDispatch}
                  editorState={editorState}
                />
              </TabPanel>
              <TabPanel>
                <Flex gap={4} flexDir="column">
                  {exports?.[0] && <ExportCard onSubmitReview={onSubmitReview} data={exports[0]}></ExportCard>}
                  {showMoreExports
                    ? exports
                        ?.slice(1)
                        .map(exp => <ExportCard onSubmitReview={onSubmitReview} data={exp} key={exp._id}></ExportCard>)
                    : null}
                  {!showMoreExports && (exports?.length ?? 0) > 1 ? (
                    <Button size="sm" onClick={() => setShowMoreExports(true)}>
                      Show Older Exports...
                    </Button>
                  ) : null}
                </Flex>
                {exports?.length === 0 ? <Text>No exports yet.</Text> : null}
              </TabPanel>
              <TabPanel>
                <Flex gap={4} flexDir="column"></Flex>
              </TabPanel>
              {eventId && (
                <TabPanel>
                  <ProgressReport eventId={eventId} />
                </TabPanel>
              )}
            </TabPanels>
          </Tabs>
        </Box>
        <Box width={{ base: '100%', md: '60%' }} position="sticky" top="40px" alignSelf="flex-start">
          <Video
            data={broll}
            isInline={true}
            highlight={highlight}
            editedWordsList={editedWords}
            isGeneratingBroll={isGeneratingBroll}
            ref={videoPlayerRef}
            isGeneratingRecropData={isGeneratingRecropData}
            onGenerateVertical={onGenerateVertical}
            generateBroll={generateBrollForPreview}
            onBeforeSave={onSaveProgrammatic}
          />
        </Box>
      </Flex>
    </>
  );
};

export const HighlightPage = () => {
  const { id, highlightId } = useParams();
  const apiService = useApiService();
  const toast = useToast();
  const navigate = useNavigate();
  const queryKey = ['highlightData', id, highlightId];
  const {
    isLoading,
    data: hlData,
    refetch
  } = useQuery({
    queryKey,
    queryFn: async () => {
      return await apiService.get<{
        data: IHighlightData;
        highlight: IHighlightInstance;
        transcript: EditedTranscript;
        broll: PopulatedVideoAIData;
      }>(`/api/highlights/${id}/${highlightId}`);
    },
    refetchOnMount: 'always'
  });

  const queryClient = useQueryClient();

  const onDelete = async (hl: IHighlightInstance) => {
    const otherHlId = hlData?.data.highlights.filter(h => h._id !== hl._id)?.[0]?._id;
    queryClient.setQueryData<
      | {
          data: IHighlightData;
          highlight: IHighlightInstance;
          transcript: EditedTranscript;
        }
      | undefined
    >(queryKey, oldData => {
      return oldData
        ? {
            ...oldData,
            data: {
              ...oldData.data,
              highlights: oldData?.data.highlights.filter(h => h._id !== hl._id)
            }
          }
        : oldData;
    });
    if (otherHlId) {
      navigate(`/highlight/${id}/${otherHlId}`);
    } else {
      navigate('/highlights');
    }
  };

  const onAcceptedForEditingSuccess = (isAcceptedForEditing: boolean, hlId: string) => {
    queryClient.setQueryData<
      | {
          data: IHighlightData;
          highlight: IHighlightInstance;
          transcript: EditedTranscript;
        }
      | undefined
    >(queryKey, oldData => {
      return oldData
        ? {
            ...oldData,
            data: {
              ...oldData.data,
              highlights: oldData?.data.highlights.map(h => (h._id !== hlId ? h : { ...h, isAcceptedForEditing }))
            }
          }
        : oldData;
    });
  };

  const onSave = async (editedWordsList: WordBaseEdited[], startIndex: number, endIndex: number) => {
    if (!data || !highlight?._id) {
      return;
    }
    const changedData: Partial<IHighlightInstance> = {
      ...highlight,
      startIndex,
      endIndex,
      editedWordsList
    };
    if (changedData) {
      await apiService.put<IHighlightInstance, Partial<IHighlightInstance>>(
        `/api/highlights/${data._id}/${highlight._id}`,
        changedData
      );
      await refetch();
      toast({
        title: 'Highlight saved.',
        description: 'Your changes have been saved and you can close the Highlight.',
        status: 'success',
        duration: 2000,
        isClosable: true
      });
    }
  };
  if (isLoading) {
    return <GlobalSpinner />;
  }
  if (!hlData) {
    return <Text>No highlight found</Text>;
  }
  const { highlight, data, broll } = hlData;

  return data && highlight && broll ? (
    <Highlight
      data={data}
      highlight={highlight}
      broll={broll}
      refetchData={refetch}
      onSave={onSave}
      onDelete={onDelete}
      onAcceptedForEditingSuccess={onAcceptedForEditingSuccess}
    />
  ) : (
    <GlobalSpinner />
  );
};
