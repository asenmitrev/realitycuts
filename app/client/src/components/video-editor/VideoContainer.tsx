import type { FC } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Segment, WordBaseEdited } from '../../types';
import 'rc-slider/assets/index.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { BiExport } from 'react-icons/bi';

import {
  Button,
  useToast,
  Box,
  Flex,
  Heading,
  Spinner,
  Tabs,
  TabPanel,
  Tab,
  TabList,
  TabPanels,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  VStack,
  Text,
  Icon
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { FaPhotoVideo } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { useApiService } from '../../hooks/useApiService';
import { FaEdit, FaSave, FaTrash } from 'react-icons/fa';
import { HighlightEditor } from '../highlight/HighlightEditor';
import { useEditedWords } from '../../hooks/useEditedWords';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { noop } from 'lodash';
import { ExportsList } from './ExportsList';
import { IoMdInformationCircleOutline } from 'react-icons/io';
import { RegenerateBrollModal } from './LibraryChoiceModal';
import type { PopulatedVideoAIData } from './Video';
import { Video } from './Video';
import { Walkthrough } from '../upload/walkthrough/Walkthrough';
import { videoEditorWalkthrough } from '../upload/walkthrough/walkthroughs';
import { FaFolder } from 'react-icons/fa6';
import { useSkipOnboarding } from '../../hooks/useSkipOnboarding';
import type { ChatMessage } from './VideoChatHistory';
import { VideoChatHistory } from './VideoChatHistory';
import { IoChatbubblesOutline } from 'react-icons/io5';
import { useQuery } from 'react-query';
import { apiService as rawApiService } from '../../service/apiService';
import { VideoEditorStoreContext, createVideoEditorStore } from '../../stores/video-editor/store';
import type { VideoEditorStore } from '../../stores/video-editor/store';
import { useEditorStateMachine } from '../../hooks/useEditorStateMachine';
import { useStore } from 'zustand';

const normalizeUpdatedAt = (value: unknown): string | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

export const VideoContainer: FC<{
  data: PopulatedVideoAIData;
  refetch?: () => void;
}> = ({ data, refetch }) => {
  const storeRef = useRef<VideoEditorStore>();
  if (!storeRef.current) {
    storeRef.current = createVideoEditorStore(data);
  }
  const hasStaleDraft = useStore(storeRef.current, state => state.hasStaleDraft);
  const restoreStaleDraft = useStore(storeRef.current, state => state.restoreStaleDraft);
  const discardStaleDraft = useStore(storeRef.current, state => state.discardStaleDraft);
  const setBaseUpdatedAt = useStore(storeRef.current, state => state.setBaseUpdatedAt);
  const apiService = useApiService();
  const [isDeleting, setIsDeleting] = useState(false);
  const hasWords = (data.editedWordsList?.length ?? 0) > 0;

  // Fetch chat history for this video (use raw apiService to avoid toast on 404)
  const { data: chatData, isLoading: isChatHistoryLoading, refetch: refetchChatHistory } = useQuery<{
    conversation: { _id: string; title: string; messages: ChatMessage[] };
  }>({
    queryKey: ['videoChatHistory', data._id],
    queryFn: async () => {
      return rawApiService.get(`/api/chat/conversations/by-video/${data._id}`);
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false
  });
  const chatMessages = chatData?.conversation?.messages ?? [];
  const conversationId = chatData?.conversation?._id;
  const hasChatHistory = Boolean(conversationId);
  // Enable chat for legacy videos: show the Chat tab whenever editing is available.
  const shouldShowChatTab = hasWords;

  const chatTabIndex = shouldShowChatTab ? 0 : -1;
  const editTabIndex = hasWords ? (shouldShowChatTab ? 1 : 0) : -1;
  const exportsTabIndex = (shouldShowChatTab ? 1 : 0) + (hasWords ? 1 : 0);

  // Preselect Edit for legacy videos (no existing conversation).
  const [tabIndex, setTabIndex] = useState(() => {
    if (hasWords) {
      if (shouldShowChatTab && !hasChatHistory) return editTabIndex;
      if (shouldShowChatTab && hasChatHistory) return chatTabIndex;
      return 0;
    }
    return exportsTabIndex;
  });
  const [isLeftPanelShown, setIsLeftPanelShown] = useState(hasWords);
  const hasChatHistoryInitialized = useRef(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);

  // When chat history loads, switch to the Chat tab and show the panel
  useEffect(() => {
    if (hasChatHistory && !hasChatHistoryInitialized.current) {
      hasChatHistoryInitialized.current = true;
      setTabIndex(chatTabIndex); // Chat tab is index 0 when it exists
      setIsLeftPanelShown(true);
    }
  }, [chatTabIndex, hasChatHistory]);

  const createConversationForVideo = async () => {
    if (isCreatingConversation || hasChatHistory) return;
    try {
      setIsCreatingConversation(true);
      await apiService.post(`/api/chat/conversations/by-video/${data._id}`, undefined, {});
      await refetchChatHistory();
    } finally {
      setIsCreatingConversation(false);
    }
  };
  const videoPlayerRef = useRef<{
    save: (title?: string) => void;
    onStartExport: () => void;
    onRegenerateBroll: (startTime: number, endTime: number, segments: Segment[]) => void;
    editorTogglePlayPause: () => void;
    editorSeekBySeconds: (deltaSeconds: number) => void;
    editorToggleBackgroundMusic: () => void;
    editorSetBackgroundMusicVolume: (volume: number) => void;
    editorToggleCurrentAltVariation: () => void;
    editorToggleCurrentAltEnabled: () => void;
    editorToggleCurrentAltVariationAtTime: (seconds: number) => void;
    editorToggleCurrentAltEnabledAtTime: (seconds: number) => void;
    editorToggleCurrentAltVisible: () => void;
    editorToggleCurrentAltVisibleAtTime: (seconds: number) => void;
    editorRemoveCurrentSegment: () => void;
    editorRemoveSegmentAtTime: (seconds: number) => void;
    editorOpenSearchForCurrentSegment: (query?: string) => void;
    editorOpenSearchAtTime: (seconds: number, query?: string) => void;
  }>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);

  // Check if onboarding parameter is present
  const searchParams = new URLSearchParams(location.search);
  const isOnboarding = searchParams.get('onboarding') === 'true';
  const handleSkip = useSkipOnboarding();

  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

  const handleWalkthroughClose = () => {
    setIsWalkthroughOpen(false);
    localStorage.setItem('videoEditorWalkthroughSeen', 'true');
  };

  const brollNativeEditedWords = useMemo(
    () =>
      data.transcriptionJob?.deepgramResults?.results?.channels?.[0]?.alternatives?.[0]?.words?.map(w => ({
        ...w,
        isVisible: true
      })),
    [data]
  );
  const transcript = (data.editedWordsList?.length ?? 0) > 0 ? data.editedWordsList : brollNativeEditedWords ?? [];
  const hasPrivateLibraryIds = Array.isArray(data.privateLibraryIds) && data.privateLibraryIds.length > 0;
  const { highlightEditorState: editorState, dispatchHighlightEditor: editorDispatch } = useEditorStateMachine({
    store: storeRef.current,
    transcript
  });
  const [isOpeningExportModal, setIsOpeningExportModal] = useState(false);
  const toast = useToast();
  const { renderDialog, awaitConfirmation } = useConfirmDialog({ title: 'Delete Project', type: 'delete' });
  const { renderDialog: renderStaleDraftDialog, awaitConfirmation: awaitStaleDraftConfirmation } = useConfirmDialog({
    title: 'Server Updated',
    type: 'confirm',
    confirmText: 'Restore old draft',
    cancelText: 'Use latest server version',
    body: 'This video was updated on the server. Restore your previous local draft (including undo/redo history)?'
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(data.title);
  const editedWords = useEditedWords(transcript, editorState);

  useEffect(() => {
    setBaseUpdatedAt(normalizeUpdatedAt((data as PopulatedVideoAIData & { updatedAt?: string | Date }).updatedAt));
  }, [data, setBaseUpdatedAt]);

  useEffect(() => {
    if (!hasStaleDraft || staleDraftPromptShownRef.current) {
      return;
    }
    staleDraftPromptShownRef.current = true;
    void (async () => {
      try {
        await awaitStaleDraftConfirmation();
        restoreStaleDraft();
        toast({
          status: 'info',
          title: 'Draft restored',
          description: 'Your local draft and undo/redo history were restored.'
        });
      } catch {
        discardStaleDraft();
      }
    })();
  }, [awaitStaleDraftConfirmation, discardStaleDraft, hasStaleDraft, restoreStaleDraft, toast]);

  const [isRegenerateBrollModalOpen, setIsRegenerateBrollModalOpen] = useState(false);
  const [brollRegenerateStartTime, setBrollRegenerateStartTime] = useState(0);
  const [brollRegenerateEndTime, setBrollRegenerateEndTime] = useState(0);
  const staleDraftPromptShownRef = useRef(false);

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
      `/api/videos/${data._id}/retranscribe`,
      {
        startTime,
        endTime
      }
    );

    editorDispatch({ type: 'REPLACE_WORDS', payload: { startTime, endTime, words: result, transcript: editedWords } });
  };

  const onSave = async () => {
    try {
      setIsSaving(true);
      await videoPlayerRef.current?.save(title);
      setIsEditingTitle(false);
    } finally {
      setIsSaving(false);
    }
  };

  const onRegenerateBroll = async (wordIds: number[]) => {
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
    setBrollRegenerateStartTime(startTime);
    setBrollRegenerateEndTime(endTime);
    setIsRegenerateBrollModalOpen(true);
  };

  const onRegenerateComplete = (segments: Segment[]) => {
    videoPlayerRef.current?.onRegenerateBroll(brollRegenerateStartTime, brollRegenerateEndTime, segments);
    setIsRegenerateBrollModalOpen(false);
  };

  const onBeforeSave = () => {
    editorDispatch({ type: 'SET_DIRTY', payload: { isDirty: false } });
  };

  const deleteVideo = async (id: string) => {
    // You can write the URL of your server or any other endpoint used for file upload
    try {
      setIsDeleting(true);
      await awaitConfirmation();
      await apiService.delete(`/api/videos/${id}`);
      navigate('/videos', { replace: true });
    } catch (error) {
      const err = error as { message?: string };
      setIsDeleting(false);

      toast({
        title: 'Error!',
        description: err.message ?? 'An error occurred deleting your upload.',
        status: 'error',
        duration: 2000,
        isClosable: true
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const onEditorDispatch = (actionType: string, payload: unknown) => {
    const api = videoPlayerRef.current;
    if (!api) return;

    const action = actionType.trim();
    if (!action) return;

    const getNumber = (key: string) => {
      if (!payload || typeof payload !== 'object') return undefined;
      if (!(key in payload)) return undefined;
      const value = (payload as Record<string, unknown>)[key];
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    };

    if (action === 'editor_toggle_background_music') {
      api.editorToggleBackgroundMusic();
      return;
    }

    if (action === 'editor_set_background_music_volume') {
      const vol = getNumber('volume');
      if (typeof vol === 'number') api.editorSetBackgroundMusicVolume(vol);
      return;
    }

    if (action === 'editor_play_pause') {
      api.editorTogglePlayPause();
      return;
    }

    if (action === 'editor_seek') {
      const seconds = getNumber('seconds');
      if (typeof seconds === 'number') api.editorSeekBySeconds(seconds);
      return;
    }

    // Swap “current alt” (b-roll variation) or toggle its visibility.
    // Accept a few aliases so backend prompt tooling can be flexible.
    if (
      action === 'TOGGLE_CURRENT_ALT' ||
      action === 'TOGGLE_CURRENT_ALT_VARIATION' ||
      action === 'editor_toggle_current_alt' ||
      action === 'editor_toggle_current_alt_variation'
    ) {
      api.editorToggleCurrentAltVariation();
      return;
    }

    if (
      action === 'TOGGLE_CURRENT_ALT_ENABLED' ||
      action === 'editor_toggle_current_alt_enabled'
    ) {
      api.editorToggleCurrentAltEnabled();
      return;
    }

    // Target a specific point in time, without requiring playback to be at that time.
    // Payload: { seconds: number }
    if (
      action === 'TOGGLE_ALT_AT_TIME' ||
      action === 'TOGGLE_CURRENT_ALT_VARIATION_AT_TIME' ||
      action === 'editor_TOGGLE_ALT_AT_TIME' ||
      action === 'editor_toggle_current_alt_variation_at_time'
    ) {
      const seconds = getNumber('seconds');
      if (typeof seconds === 'number') api.editorToggleCurrentAltVariationAtTime(seconds);
      return;
    }

    if (
      action === 'TOGGLE_CURRENT_ALT_ENABLED_AT_TIME' ||
      action === 'editor_toggle_current_alt_enabled_at_time'
    ) {
      const seconds = getNumber('seconds');
      if (typeof seconds === 'number') api.editorToggleCurrentAltEnabledAtTime(seconds);
      return;
    }

    if (
      action === 'TOGGLE_CURRENT_ALT_VISIBLE' ||
      action === 'editor_toggle_current_alt_visible'
    ) {
      api.editorToggleCurrentAltVisible();
      return;
    }

    if (
      action === 'TOGGLE_ALT_VISIBLE_AT_TIME' ||
      action === 'editor_toggle_alt_visible_at_time'
    ) {
      const seconds = getNumber('seconds');
      if (typeof seconds === 'number') api.editorToggleCurrentAltVisibleAtTime(seconds);
      return;
    }

    if (
      action === 'REMOVE_CURRENT_SEGMENT' ||
      action === 'editor_remove_current_segment'
    ) {
      api.editorRemoveCurrentSegment();
      return;
    }

    if (
      action === 'REMOVE_SEGMENT_AT_TIME' ||
      action === 'editor_remove_segment_at_time'
    ) {
      const seconds = getNumber('seconds');
      if (typeof seconds === 'number') api.editorRemoveSegmentAtTime(seconds);
      return;
    }

    if (
      action === 'OPEN_SEARCH_FOOTAGE_MODAL' ||
      action === 'editor_open_search_footage_modal'
    ) {
      const seconds = getNumber('seconds');
      const query =
        payload && typeof payload === 'object' && 'query' in payload
          ? String((payload as Record<string, unknown>).query ?? '')
          : undefined;
      if (typeof seconds === 'number') {
        api.editorOpenSearchAtTime(seconds, query || undefined);
      } else {
        api.editorOpenSearchForCurrentSegment(query || undefined);
      }
      return;
    }
  }

  const speakerMap = useMemo(() => ({}), []);

  const shimmerAnimation = keyframes`
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  `;

  const pulseAnimation = keyframes`
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  `;

  const onStartExport = async () => {
    setIsOpeningExportModal(true);
    await videoPlayerRef.current?.onStartExport();
    setIsOpeningExportModal(false);
  };
  return (
    <VideoEditorStoreContext.Provider value={storeRef.current}>
      <Heading
        px={8}
        flexGrow={0}
        py={10}
        display="flex"
        gap={4}
        alignItems="center"
        maxW="100%"
        cursor="text"
        justifyContent="space-between"
        flexWrap="nowrap"
      >
        <Box
          whiteSpace="nowrap"
          flexGrow={1}
          textOverflow="ellipsis"
          overflow="hidden"
          onClick={() => setIsEditingTitle(true)}
        >
          {isEditingTitle ? (
            <InputGroup w="100%" maxW="50vw">
              <Input
                fontSize="4xl"
                fontWeight="bold"
                variant="ghost"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onSave();
                    setIsEditingTitle(false);
                  }
                }}
              />
              <InputRightElement bg="black">
                <IconButton
                  aria-label="Save"
                  icon={<FaSave />}
                  isLoading={isSaving}
                  onClick={() => {
                    onSave();
                    setIsEditingTitle(false);
                  }}
                />
              </InputRightElement>
            </InputGroup>
          ) : (
            data.title ?? 'Untitled'
          )}
        </Box>
        <Flex gap={4}>
          {isOnboarding && (
            <Button variant="ghost" colorScheme="gray" onClick={() => handleSkip()}>
              Skip onboarding
            </Button>
          )}
          <Button
            colorScheme="red"
            variant="outline"
            onClick={() => deleteVideo(data._id)}
            isLoading={isDeleting}
            isDisabled={isDeleting}
          >
            <FaTrash />
          </Button>
          <Button colorScheme="blue" variant="outline" onClick={onSave} isLoading={isSaving} isDisabled={isSaving}>
            <FaSave />
          </Button>
          <Button
            colorScheme="white"
            variant="outline"
            data-walkthrough-step="downloads"
            onClick={() => {
              setIsLeftPanelShown(true);
              setTabIndex(exportsTabIndex);
            }}
          >
            <FaFolder />
          </Button>
          <Button
            colorScheme="white"
            onClick={() => onStartExport()}
            isLoading={isOpeningExportModal}
            leftIcon={<BiExport />}
          >
            Export
          </Button>
        </Flex>
      </Heading>
      <Flex gap={6} flexGrow={1} alignItems="stretch" flex="1 1 auto" overflow="hidden">
        {isLeftPanelShown && (
          <Box width={{ base: '30%', md: '30%' }} px={8} pb={10} overflow="auto" h="100%" minH={0}>
            <Tabs
              variant="unstyled"
              index={tabIndex}
              display="flex"
              flexDirection="column"
              h="100%"
              minH={0}
              onChange={index => {
                setTabIndex(index);
              }}
            >
              <TabList p={0} gap={2} tabIndex={tabIndex}>
                {shouldShowChatTab ? (
                  <Tab p={0} fontWeight="bold" as="div">
                    <Button
                      colorScheme={tabIndex === 0 ? 'white' : 'gray'}
                      aria-label="Chat"
                      size="sm"
                      leftIcon={<IoChatbubblesOutline />}
                      isLoading={isCreatingConversation || (isChatHistoryLoading && !hasChatHistory)}
                      loadingText="Loading"
                      onClick={async (e) => {
                        // Prevent Chakra Tabs from switching until we have a conversation
                        e.preventDefault();
                        e.stopPropagation();
                        setIsLeftPanelShown(true);
                        if (!hasChatHistory) {
                          await createConversationForVideo();
                        }
                        setTabIndex(chatTabIndex);
                      }}
                    >
                      Chat
                    </Button>
                  </Tab>
                ) : null}
                {hasWords ? (
                  <Tab p={0} fontWeight="bold" as="div">
                    <Button
                      form="edit"
                      colorScheme={tabIndex === editTabIndex ? 'white' : 'gray'}
                      aria-label="Edit"
                      size="sm"
                      leftIcon={<FaEdit />}
                    >
                      Edit
                    </Button>
                  </Tab>
                ) : null}
                {hasWords ? (
                  <IconButton
                    aria-label="Info"
                    variant="ghost"
                    size="sm"
                    borderRadius="full"
                    icon={<IoMdInformationCircleOutline size={24} />}
                    onClick={() => setIsWalkthroughOpen(true)}
                  />
                ) : null}
              </TabList>
              <TabPanels p={0} flex="1" minH={0}>
                {shouldShowChatTab ? (
                  <TabPanel p={0} pt={3} h="100%" minH={0}>
                    {isChatHistoryLoading && !hasChatHistory ? (
                      <Flex align="center" justify="center" minH="240px">
                        <Spinner thickness="3px" speed="0.7s" />
                      </Flex>
                    ) : !hasChatHistory ? (
                      <Flex align="center" justify="center" minH="240px">
                        <Text color="whiteAlpha.700" fontSize="sm" textAlign="center" px={4}>
                          Press “Chat” to start a conversation for this video.
                        </Text>
                      </Flex>
                    ) : (
                      <VideoChatHistory
                        messages={chatMessages}
                        conversationId={conversationId}
                        videoAIDataId={data._id}
                        segments={data.segments}
                        onVideoUpdated={refetch}
                        onEditorDispatch={onEditorDispatch}
                      />
                    )}
                  </TabPanel>
                ) : null}
                {hasWords ? (
                  <TabPanel p={0} pt={3}>
                    {!hasPrivateLibraryIds && (
                      <Box
                        mb={4}
                        p={5}
                        borderRadius="xl"
                        bg="linear-gradient(135deg, rgba(236, 137, 51, 0.15) 0%, rgba(34, 208, 255, 0.08) 50%, rgba(246, 163, 85, 0.12) 100%)"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        position="relative"
                        overflow="hidden"
                      >
                        {/* Subtle animated glow */}
                        <Box
                          position="absolute"
                          top="-40%"
                          right="-15%"
                          w="120px"
                          h="120px"
                          borderRadius="full"
                          bg="radial-gradient(circle, rgba(34, 208, 255, 0.15) 0%, transparent 70%)"
                          animation={`${pulseAnimation} 4s ease-in-out infinite`}
                        />
                        <Box
                          position="absolute"
                          bottom="-30%"
                          left="-10%"
                          w="100px"
                          h="100px"
                          borderRadius="full"
                          bg="radial-gradient(circle, rgba(236, 137, 51, 0.12) 0%, transparent 70%)"
                          animation={`${pulseAnimation} 5s ease-in-out infinite`}
                        />

                        <VStack spacing={3} position="relative" zIndex={1}>
                          {/* Icon */}
                          <Box
                            w={10}
                            h={10}
                            borderRadius="full"
                            bg="linear-gradient(135deg, #22D0FF 0%, #ec8933 100%)"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            boxShadow="0 4px 20px rgba(34, 208, 255, 0.3)"
                          >
                            <Icon as={FaPhotoVideo} boxSize={4} color="white" />
                          </Box>

                          {/* Title with gradient */}
                          <Heading
                            as="h4"
                            fontSize="md"
                            fontWeight="700"
                            textAlign="center"
                            bgGradient="linear(to-r, #22D0FF, #ec8933, #f6a355)"
                            bgClip="text"
                            bgSize="200% auto"
                            animation={`${shimmerAnimation} 4s linear infinite`}
                            letterSpacing="-0.01em"
                          >
                            Want better results?
                          </Heading>

                          {/* Description */}
                          <Text fontSize="xs" color="gray.300" textAlign="center" lineHeight="1.5">
                            Your video is using public video libraries, which are limited. Create your own library with
                            personal footage for results perfectly tailored to your content.
                          </Text>

                          {/* CTA Button */}
                          <Button
                            size="sm"
                            bg="linear-gradient(135deg, #22D0FF 0%, #ec8933 100%)"
                            color="white"
                            fontWeight="600"
                            px={4}
                            _hover={{
                              bg: 'linear-gradient(135deg, #1bc4f0 0%, #d97a2a 100%)',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 20px rgba(34, 208, 255, 0.4)'
                            }}
                            _active={{ transform: 'translateY(0)' }}
                            transition="all 0.2s"
                            leftIcon={<Icon as={HiSparkles} />}
                            onClick={() => navigate('/library/add?onboarding=true')}
                          >
                            Create Your Library
                          </Button>
                        </VStack>
                      </Box>
                    )}
                    <HighlightEditor
                      onRetranscribe={onRetranscribe}
                      isEnabled={true}
                      speakerMap={speakerMap}
                      onAcceptForEditing={noop}
                      onRegenerateBroll={onRegenerateBroll}
                      editorDispatch={editorDispatch}
                      editorState={editorState}
                    />
                  </TabPanel>
                ) : null}
                <TabPanel p={0} pt={4}>
                  <ExportsList brollId={data._id} />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        )}
        <Box width={{ base: isLeftPanelShown ? '70%' : '100%' }} h="100%" alignSelf="flex-start" px={4}>
          <Video
            key={data.voiceOver ?? data._id}
            generateBroll={noop}
            data={data}
            ref={videoPlayerRef}
            isHighlight={false}
            highlight={data.highlightInstanceId}
            editedWordsList={editedWords}
            onBeforeSave={onBeforeSave}
            onRefresh={refetch}
            isDeleting={isDeleting}
            isDirty={editorState.isDirty}
          />
        </Box>
      </Flex>
      {isRegenerateBrollModalOpen && (
        <RegenerateBrollModal
          isOpen={isRegenerateBrollModalOpen}
          onClose={() => setIsRegenerateBrollModalOpen(false)}
          startTime={brollRegenerateStartTime}
          endTime={brollRegenerateEndTime}
          videoId={data._id}
          onRegenerateComplete={onRegenerateComplete}
          privateLibraryIds={data.privateLibraryIds ?? []}
          publicLibraryIds={data.publicLibraryIds ?? []}
        />
      )}
      <Walkthrough steps={videoEditorWalkthrough} isOpen={isWalkthroughOpen} onClose={handleWalkthroughClose} />
      {renderDialog()}
      {renderStaleDraftDialog()}
    </VideoEditorStoreContext.Provider>
  );
};
