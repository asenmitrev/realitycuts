import { FC } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Badge,
  IconButton,
  useColorModeValue,
  Card,
  CardBody,
  CardHeader,
  Switch,
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Alert,
  AlertIcon,
  Flex,
  Grid,
  GridItem
} from '@chakra-ui/react';
import { FiEdit, FiTrash2, FiPlus, FiCalendar } from 'react-icons/fi';
import { CalendarIcon } from '@chakra-ui/icons';
import { WeeklyScheduleView } from './WeeklyScheduleView';
import { FaCog, FaMusic, FaVideo } from 'react-icons/fa';
import {
  useAutomationConfigs,
  useDeleteAutomationConfig,
  useToggleAutomationConfig
} from '../../hooks/useAutomationConfig';
import { IAutomationConfig } from '../../types';
import { useRef, useState } from 'react';
import { convertDailyTimesToLocal, convertUTCTimeToLocal, getTimezoneName } from '../../utils/timezone';
import { GlobalSpinner } from '../common/GlobalSpinner';

export const AutomationConfigList: FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: configs, isLoading } = useAutomationConfigs();
  const deleteMutation = useDeleteAutomationConfig();
  const toggleMutation = useToggleAutomationConfig();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isScheduleOpen, onOpen: onScheduleOpen, onClose: onScheduleClose } = useDisclosure();
  const [configToDelete, setConfigToDelete] = useState<IAutomationConfig | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const textColor = useColorModeValue('white', 'white');

  // Check if we're coming from onboarding
  const isFromOnboarding = searchParams.get('onboarding') === 'true';

  // Function to dismiss the onboarding alert
  const dismissOnboardingAlert = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('onboarding');
    setSearchParams(newSearchParams);
  };

  // Helper function to format time in AM/PM format
  const formatTimeAmPm = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  };

  const handleDelete = (config: IAutomationConfig) => {
    setConfigToDelete(config);
    onOpen();
  };

  const confirmDelete = async () => {
    if (configToDelete) {
      try {
        await deleteMutation.mutateAsync(configToDelete._id);
        setConfigToDelete(null);
        onClose();
      } catch (error) {
        console.error('Error deleting automation:', error);
      }
    }
  };

  const handleToggle = async (config: IAutomationConfig) => {
    try {
      await toggleMutation.mutateAsync({
        id: config._id,
        isEnabled: !config.isEnabled
      });
    } catch (error) {
      console.error('Error toggling automation:', error);
    }
  };

  const formatSchedule = (config: IAutomationConfig) => {
    if (config.schedule.type === 'DAILY') {
      const utcTimes = config.schedule.dailyTimes || [];
      // Convert UTC times to local times for display
      const localTimes = convertDailyTimesToLocal(utcTimes);
      return (
        <VStack align="start" spacing={1}>
          <Text fontWeight="medium" color="white">
            Daily
          </Text>
          <HStack spacing={1} flexWrap="wrap">
            {localTimes.map((time, index) => (
              <Text key={index} fontSize="xs">
                {formatTimeAmPm(time.hour, time.minute)}
                {index === localTimes.length - 1 ? '' : ','}
              </Text>
            ))}
          </HStack>
        </VStack>
      );
    } else {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const selectedDays = (config.schedule.weeklyDays || []).map(d => days[d]);
      const utcTime = config.schedule.weeklyTime;
      // Convert UTC time to local time for display
      const localTime = utcTime ? convertUTCTimeToLocal(utcTime) : null;
      const timeStr = localTime ? formatTimeAmPm(localTime.hour, localTime.minute) : '';
      return (
        <VStack align="start" spacing={1}>
          <Text fontWeight="medium" color="white">
            Weekly
          </Text>
          <HStack spacing={1} flexWrap="wrap">
            {selectedDays.map((day, index) => (
              <Text key={index} fontSize="xs">
                {day}
              </Text>
            ))}
          </HStack>
          {timeStr && (
            <Badge colorScheme="blue" fontSize="xs">
              {timeStr}
            </Badge>
          )}
        </VStack>
      );
    }
  };

  if (isLoading) {
    return <GlobalSpinner />;
  }

  return (
    <Container py={8} w="100%" maxW={{ base: '100%', md: '900px', lg: '1000', xl: '1200' }} pb={10}>
      <VStack spacing={6} align="stretch">
        <HStack
          justify={{ base: 'flex-start', md: 'space-between' }}
          align={{ base: 'flex-start', md: 'center' }}
          flexDirection={{ base: 'column', md: 'row' }}
          gap={{ base: 4, md: 0 }}
        >
          <Box>
            <Heading color={textColor} mb={2}>
              Automations
            </Heading>
            <Text color="gray.400" mb={1}>
              Manage your automated video creation schedules
            </Text>
            <Text color="gray.500" fontSize="sm">
              All times shown in {getTimezoneName()} timezone
            </Text>
          </Box>
          <HStack spacing={2}>
            <Button
              leftIcon={<FiCalendar />}
              colorScheme="white"
              variant="outline"
              onClick={onScheduleOpen}
              isDisabled={!configs || configs.length === 0}
            >
              Weekly Schedule
            </Button>
            <Button leftIcon={<FiPlus />} colorScheme="white" onClick={() => navigate('/automation-configs/new')}>
              Automation
            </Button>
          </HStack>
        </HStack>

        {/* Onboarding Success Alert */}
        {isFromOnboarding && (
          <Alert status="success" borderRadius="md" bg="green.900" borderColor="green.600" borderWidth="1px">
            <AlertIcon />
            <Box flex="1">
              <Text fontWeight="bold" color="white">
                🎉 Onboarding Complete!
              </Text>
              <Text color="green.100">
                We've successfully set up a daily automation for you! Your videos will be automatically created and
                published once daily using your connected libraries and channels. If you want to tweak the automation,
                you can do so in the automation settings.
              </Text>
            </Box>
            <Button
              size="sm"
              variant="ghost"
              color="green.300"
              _hover={{ color: 'white', bg: 'green.800' }}
              onClick={dismissOnboardingAlert}
            >
              Dismiss
            </Button>
          </Alert>
        )}

        {!configs || configs.length === 0 ? (
          <Alert status="info" borderRadius="md" bg="blue.900" borderColor="blue.600">
            <AlertIcon />
            <Box>
              <Text fontWeight="bold">No automations yet</Text>
              <Text>Create your first automation to start generating videos automatically.</Text>
            </Box>
          </Alert>
        ) : (
          <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
            {configs.map(config => (
              <GridItem key={config._id}>
                <Card h="full">
                  <CardHeader pb={3}>
                    <Flex justify="space-between" align="center">
                      <HStack spacing={3}>
                        <Text fontSize="xl" fontWeight="semibold" color="white">
                          {config.contentSettings?.theme || 'Automation'}
                        </Text>
                        {config.environment === 'uat' && <Badge colorScheme="yellow">UAT</Badge>}
                        <Badge colorScheme={config.isEnabled ? 'green' : 'red'}>{config.status}</Badge>
                      </HStack>
                      <HStack spacing={2} alignItems="center">
                        <Switch
                          colorScheme="blue"
                          isChecked={config.isEnabled}
                          onChange={() => handleToggle(config)}
                          isDisabled={toggleMutation.isLoading}
                          mr={2}
                        />
                        {/* <IconButton
                          as={Link}
                          to={`/automation-configs/${config._id}/edit`}
                          aria-label="Edit config"
                          icon={<FiEdit />}
                          variant="ghost"
                          color="gray.400"
                          _hover={{ color: 'white' }}
                          size="sm"
                        /> */}
                        <IconButton
                          aria-label="Delete config"
                          icon={<FiTrash2 />}
                          variant="ghost"
                          color="red.400"
                          _hover={{ color: 'red.300' }}
                          size="sm"
                          onClick={() => handleDelete(config)}
                          isDisabled={deleteMutation.isLoading}
                        />
                      </HStack>
                    </Flex>
                  </CardHeader>

                  <CardBody pt={0}>
                    <VStack spacing={4} align="stretch">
                      {/* Row 1: Schedule and Music */}
                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                        <GridItem>
                          <HStack spacing={3}>
                            <Box p={1.5} bg="gray.800" borderRadius="lg">
                              <CalendarIcon w={5} h={5} color="blue.400" />
                            </Box>
                            <VStack align="start" spacing={0}>
                              <Text fontSize="sm" color="gray.400">
                                Schedule
                              </Text>
                              {formatSchedule(config)}
                            </VStack>
                          </HStack>
                        </GridItem>

                        <GridItem>
                          <HStack spacing={3}>
                            <Box p={1.5} bg="gray.800" borderRadius="lg">
                              <Box as={FaMusic} w={5} h={5} color="green.400" />
                            </Box>
                            <VStack align="start" spacing={0}>
                              <Text fontSize="sm" color="gray.400">
                                Music
                              </Text>
                              <Text fontWeight="medium" color="white">
                                {config.contentSettings.includeMusic ? 'Enabled' : 'Disabled'}
                              </Text>
                            </VStack>
                          </HStack>
                        </GridItem>
                      </Grid>

                      {/* Row 2: Orientation */}
                      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                        {/* Orientation */}
                        {config.contentSettings.orientation && (
                          <GridItem>
                            <HStack spacing={3}>
                              <Box p={1.5} bg="gray.800" borderRadius="lg">
                                <Box as={FaVideo} w={5} h={5} color="orange.400" />
                              </Box>
                              <VStack align="start" spacing={0}>
                                <Text fontSize="sm" color="gray.400">
                                  Orientation
                                </Text>
                                <Text fontWeight="medium" color="white" textTransform="capitalize">
                                  {config.contentSettings.orientation}
                                </Text>
                              </VStack>
                            </HStack>
                          </GridItem>
                        )}
                      </Grid>

                      {/* Theme Section */}
                      {config.contentSettings.theme && (
                        <Box>
                          <HStack spacing={3}>
                            <Box p={1.5} bg="gray.800" borderRadius="lg">
                              <FaCog color="blue.400" />
                            </Box>
                            <VStack align="start" spacing={0} flex={1}>
                              <Text fontSize="sm" color="gray.400">
                                Theme
                              </Text>
                              <Text fontWeight="medium" color="white" noOfLines={2}>
                                {config.contentSettings.theme}
                              </Text>
                            </VStack>
                          </HStack>
                        </Box>
                      )}
                      {/* Edit CTA */}
                      <Button
                        as={Link}
                        to={`/automation-configs/${config._id}/edit`}
                        leftIcon={<FiEdit />}
                        colorScheme="white"
                        variant="solid"
                        w="full"
                        mt={2}
                      >
                        Edit Automation
                      </Button>
                    </VStack>
                  </CardBody>
                </Card>
              </GridItem>
            ))}
          </Grid>
        )}
      </VStack>

      {/* Weekly Schedule Modal */}
      <WeeklyScheduleView
        isOpen={isScheduleOpen}
        onClose={onScheduleClose}
        configs={configs || []}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
        <AlertDialogOverlay backdropFilter="blur(5px)">
          <AlertDialogContent bg="black">
            <AlertDialogHeader color="white">Delete Automation</AlertDialogHeader>
            <AlertDialogBody color="white">
              Are you sure you want to delete the automation for{' '}
              <strong>{configToDelete?.contentSettings?.theme || 'this automation'}</strong>? This action cannot be
              undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3} isLoading={deleteMutation.isLoading}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Container>
  );
};
