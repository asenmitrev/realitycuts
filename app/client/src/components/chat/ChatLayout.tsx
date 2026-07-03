import { FC, PropsWithChildren, useState, createContext, useContext, useCallback } from 'react';
import { Box, Flex, Link, Button, IconButton, useBreakpointValue } from '@chakra-ui/react';
import { Link as RouterLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../navbar/Logo';
import { MdDashboard } from 'react-icons/md';
import { IoMenuOutline, IoCloseOutline } from 'react-icons/io5';
import { TrackingProvider } from '../../contexts/tracking/TrackingProvider';
import { ChatSidebar } from './ChatSidebar';
import { ChatProvider } from './ChatContext';
import { VideoPreviewPanel } from './VideoPreviewPanel';
import { VideoPreviewData } from './types';
import { VideoAIData } from '../../types';
import { useFirebaseAuthenticationService } from '../../contexts/firebase/hooks';

interface VideoPreviewContextValue {
  videoPreviewData: VideoPreviewData | null;
  videoAIDataId: string | null;
  fullVideoData: VideoAIData | null;
  setVideoPreviewData: (data: VideoPreviewData | null, videoAIDataId?: string | null, fullVideoData?: VideoAIData | null) => void;
  clearVideoPreview: () => void;
}

const VideoPreviewContext = createContext<VideoPreviewContextValue | null>(null);

export const useVideoPreviewContext = () => {
  const context = useContext(VideoPreviewContext);
  if (!context) {
    throw new Error('useVideoPreviewContext must be used within ChatLayout');
  }
  return context;
};

const ChatNavBar: FC<{
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}> = ({ onToggleSidebar, isSidebarOpen }) => {
  const { logout } = useFirebaseAuthenticationService();
  const navigate = useNavigate();

  const handleSwitchAccount = () => {
    logout();
    navigate('/login');
  };

  return (
    <Flex
      as="nav"
      align="center"
      justify="space-between"
      wrap="nowrap"
      w="100%"
      h="56px"
      paddingX={{ base: 4, md: 8 }}
      bg="whiteAlpha.50"
      borderBottom="1px solid"
      borderColor="whiteAlpha.100"
      backdropFilter="blur(10px)"
      position="sticky"
      top={0}
      zIndex={100}
    >
      {/* Left side: Menu toggle and Logo */}
      <Flex align="center" gap={2}>
        <IconButton
          aria-label="Toggle sidebar"
          icon={isSidebarOpen ? <IoCloseOutline size={22} /> : <IoMenuOutline size={22} />}
          onClick={onToggleSidebar}
          variant="ghost"
          colorScheme="whiteAlpha"
          color="white"
          size="sm"
          display={{ base: 'flex', lg: 'none' }}
          _hover={{ bg: 'whiteAlpha.200' }}
        />
        <Link as={RouterLink} to="/" _hover={{ textDecoration: 'none' }}>
          <Logo color="blue.800" />
        </Link>
      </Flex>

      {/* Right side: Dashboard link and account actions */}
      <Flex gap={4} align="center">
        <Link
          as={RouterLink}
          to="/videos"
          _hover={{ textDecoration: 'none' }}
        >
          <Button
            size="sm"
            variant="outline"
            colorScheme="white"
            leftIcon={<MdDashboard />}
            borderRadius="8px"
            fontWeight="500"
          >
            Dashboard
          </Button>
        </Link>
        <Button
          size="sm"
          variant="ghost"
          borderRadius="8px"
          fontWeight="500"
          onClick={handleSwitchAccount}
        >
          Switch account
        </Button>
      </Flex>
    </Flex>
  );
};

export const ChatLayout: FC<PropsWithChildren> = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [videoPreviewData, setVideoPreviewDataState] = useState<VideoPreviewData | null>(null);
  const [videoAIDataId, setVideoAIDataId] = useState<string | null>(null);
  const [fullVideoData, setFullVideoData] = useState<VideoAIData | null>(null);
  const isDesktop = useBreakpointValue({ base: false, lg: true });

  const toggleSidebar = () => {
    setIsMobileSidebarOpen(prev => !prev);
  };

  const setVideoPreviewData = useCallback((data: VideoPreviewData | null, id?: string | null, fullData?: VideoAIData | null) => {
    setVideoPreviewDataState(data);
    setVideoAIDataId(id ?? null);
    setFullVideoData(fullData ?? null);
  }, []);

  const clearVideoPreview = useCallback(() => {
    setVideoPreviewDataState(null);
    setVideoAIDataId(null);
    setFullVideoData(null);
  }, []);

  const videoPreviewContextValue: VideoPreviewContextValue = {
    videoPreviewData,
    videoAIDataId,
    fullVideoData,
    setVideoPreviewData,
    clearVideoPreview
  };

  return (
    <Box h="100vh" w="100vw" display="flex" flexDirection="column" overflow="hidden">
      <ChatNavBar
        onToggleSidebar={toggleSidebar}
        isSidebarOpen={isMobileSidebarOpen}
      />
      <TrackingProvider>
        <ChatProvider>
          <VideoPreviewContext.Provider value={videoPreviewContextValue}>
            <Flex flex="1" minH={0} overflow="hidden" alignItems="stretch">
              {/* Desktop sidebar - always visible */}
              <Box display={{ base: 'none', lg: 'block' }} h="100%">
                <ChatSidebar />
              </Box>

              {/* Mobile sidebar - overlay */}
              {!isDesktop && isMobileSidebarOpen && (
                <>
                  <Box
                    position="fixed"
                    top="56px"
                    left={0}
                    right={0}
                    bottom={0}
                    bg="blackAlpha.600"
                    zIndex={10}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    onTouchStart={(e) => {
                      if (e.target === e.currentTarget) {
                        setIsMobileSidebarOpen(false);
                      }
                    }}
                  />
                  <Box
                    position="fixed"
                    top="56px"
                    left={0}
                    bottom={0}
                    zIndex={11}
                    h="calc(100vh - 56px)"
                    pointerEvents="auto"
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <ChatSidebar />
                  </Box>
                </>
              )}

              {/* Main content area */}
              <Box flex="1" minW={0} minH={0} overflow="hidden">
                <Outlet />
              </Box>
            </Flex>

            {/* Mobile-only video preview (floating sheet) */}
            <VideoPreviewPanel
              data={videoPreviewData}
              videoAIDataId={videoAIDataId}
              fullVideoData={fullVideoData}
              onClose={clearVideoPreview}
            />
          </VideoPreviewContext.Provider>
        </ChatProvider>
      </TrackingProvider>
    </Box>
  );
};
