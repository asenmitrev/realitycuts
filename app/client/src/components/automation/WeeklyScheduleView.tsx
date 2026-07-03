import { type FC, useMemo, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Text,
  Badge,
  HStack,
  VStack,
  Flex,
  Select,
  Checkbox,
  Tooltip,
  Divider,
} from '@chakra-ui/react';
import type { IAutomationConfig } from '../../types';
import { convertDailyTimesToLocal, convertUTCTimeToLocal } from '../../utils/timezone';

interface WeeklyScheduleViewProps {
  isOpen: boolean;
  onClose: () => void;
  configs: IAutomationConfig[];
}

interface ScheduleEntry {
  config: IAutomationConfig;
  localTime: { hour: number; minute: number };
  channelLabel: string;
  scheduleType: 'DAILY' | 'WEEKLY';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatTimeAmPm = (hour: number, minute: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
};

const getChannelLabel = (config: IAutomationConfig): string => {
  return config.contentSettings?.theme || 'Unnamed';
};

const getEntryAccentColor = (isEnabled: boolean): string => {
  return isEnabled ? 'blue.400' : 'gray.600';
};

export const WeeklyScheduleView: FC<WeeklyScheduleViewProps> = ({ isOpen, onClose, configs }) => {
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [showDisabled, setShowDisabled] = useState(true);

  const channelOptions = useMemo(() => {
    const labels = Array.from(new Set(configs.map(getChannelLabel)));
    return labels.sort();
  }, [configs]);

  const filteredConfigs = useMemo(() => {
    return configs.filter(config => {
      if (!showDisabled && !config.isEnabled) return false;
      if (channelFilter !== 'all' && getChannelLabel(config) !== channelFilter) return false;
      return true;
    });
  }, [configs, channelFilter, showDisabled]);

  const scheduleByDay = useMemo(() => {
    const result: Record<number, ScheduleEntry[]> = {};
    for (let d = 0; d < 7; d++) result[d] = [];

    for (const config of filteredConfigs) {
      const channelLabel = getChannelLabel(config);

      if (config.schedule.type === 'DAILY') {
        const localTimes = convertDailyTimesToLocal(config.schedule.dailyTimes || []);
        for (const localTime of localTimes) {
          for (let d = 0; d < 7; d++) {
            result[d].push({ config, localTime, channelLabel, scheduleType: 'DAILY' });
          }
        }
      } else if (config.schedule.type === 'WEEKLY') {
        const days = config.schedule.weeklyDays || [];
        const utcTime = config.schedule.weeklyTime;
        if (!utcTime) continue;
        const localTime = convertUTCTimeToLocal(utcTime);
        for (const day of days) {
          result[day].push({ config, localTime, channelLabel, scheduleType: 'WEEKLY' });
        }
      }
    }

    for (let d = 0; d < 7; d++) {
      result[d].sort((a, b) => {
        const aMin = a.localTime.hour * 60 + a.localTime.minute;
        const bMin = b.localTime.hour * 60 + b.localTime.minute;
        return aMin - bMin;
      });
    }

    return result;
  }, [filteredConfigs]);

  const totalPostsPerWeek = useMemo(
    () => Object.values(scheduleByDay).reduce((sum, day) => sum + day.length, 0),
    [scheduleByDay]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(6px)" bg="blackAlpha.700" />
      <ModalContent bg="gray.900" border="1px solid" borderColor="gray.700" maxH="90vh" mx={4}>
        <ModalHeader pb={3}>
          <HStack justify="space-between" align="flex-start" pr={8}>
            <VStack align="start" spacing={0.5}>
              <Text color="white" fontSize="xl" fontWeight="bold">
                Weekly Schedule
              </Text>
              <HStack spacing={3}>
                <Text fontSize="sm" color="gray.400" fontWeight="normal">
                  Overview of your automation posting schedule
                </Text>
                <Badge colorScheme="blue" fontSize="xs" fontWeight="normal">
                  {totalPostsPerWeek} posts/week
                </Badge>
              </HStack>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="gray.400" _hover={{ color: 'white' }} top={4} right={4} />

        <Divider borderColor="gray.700" />

        <ModalBody pt={4} pb={6} px={4}>
          {/* Filters */}
          <HStack spacing={4} mb={5} flexWrap="wrap">
            <Select
              size="sm"
              maxW="200px"
              bg="gray.800"
              color="white"
              borderColor="gray.600"
              _hover={{ borderColor: 'gray.500' }}
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              sx={{ option: { background: '#1A202C', color: 'white' } }}
            >
              <option value="all">All Channels</option>
              {channelOptions.map(ch => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </Select>
            <Checkbox
              isChecked={showDisabled}
              onChange={e => setShowDisabled(e.target.checked)}
              colorScheme="blue"
              size="sm"
            >
              <Text fontSize="sm" color="gray.300">
                Show disabled
              </Text>
            </Checkbox>
          </HStack>

          {/* Weekly Grid */}
          <Box overflowX="auto">
            <Flex gap={2} minW="600px">
              {DAYS.map((day, dayIdx) => {
                const entries = scheduleByDay[dayIdx];
                const isToday = new Date().getDay() === dayIdx;
                return (
                  <Box key={day} flex={1} minW={0}>
                    {/* Day header */}
                    <Box
                      bg={isToday ? 'blue.900' : 'gray.800'}
                      borderRadius="md"
                      p={2}
                      mb={2}
                      textAlign="center"
                      border="1px solid"
                      borderColor={isToday ? 'blue.600' : 'gray.700'}
                    >
                      <Text fontSize="sm" fontWeight="bold" color={isToday ? 'blue.300' : 'gray.300'}>
                        {day}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {entries.length > 0 ? `${entries.length} post${entries.length !== 1 ? 's' : ''}` : '—'}
                      </Text>
                    </Box>

                    {/* Entries */}
                    <VStack spacing={1.5} align="stretch" minH="120px">
                      {entries.length === 0 ? (
                        <Box
                          bg="gray.800"
                          borderRadius="md"
                          p={3}
                          opacity={0.35}
                          border="1px dashed"
                          borderColor="gray.700"
                          textAlign="center"
                        >
                          <Text fontSize="xs" color="gray.600">
                            No posts
                          </Text>
                        </Box>
                      ) : (
                        entries.map(entry => {
                          const accentColor = getEntryAccentColor(entry.config.isEnabled);
                          const entryKey = `${entry.config._id}-${entry.localTime.hour}-${entry.localTime.minute}-${dayIdx}`;
                          return (
                            <Tooltip
                              key={entryKey}
                              label={
                                <VStack align="start" spacing={0.5} p={1}>
                                  <Text fontWeight="bold">{entry.channelLabel}</Text>
                                  <Text fontSize="xs" color="gray.300">
                                    {entry.scheduleType === 'DAILY' ? 'Daily' : 'Weekly'} ·{' '}
                                    {formatTimeAmPm(entry.localTime.hour, entry.localTime.minute)}
                                  </Text>
                                  {!entry.config.isEnabled && (
                                    <Badge colorScheme="red" fontSize="xs">
                                      Disabled
                                    </Badge>
                                  )}
                                </VStack>
                              }
                              placement="top"
                              hasArrow
                              bg="gray.800"
                              borderColor="gray.600"
                              border="1px solid"
                            >
                              <Box
                                bg={entry.config.isEnabled ? 'gray.800' : 'gray.850'}
                                borderRadius="md"
                                p={2}
                                borderLeft="3px solid"
                                borderColor={accentColor}
                                opacity={entry.config.isEnabled ? 1 : 0.55}
                                cursor="default"
                                _hover={{ bg: entry.config.isEnabled ? 'gray.750' : 'gray.800' }}
                                transition="background 0.15s"
                              >
                                <Text fontSize="xs" fontWeight="bold" color={accentColor} mb={0.5}>
                                  {formatTimeAmPm(entry.localTime.hour, entry.localTime.minute)}
                                </Text>
                                <Text fontSize="xs" color="white" noOfLines={1} title={entry.channelLabel}>
                                  {entry.channelLabel}
                                </Text>
                                <HStack spacing={1} mt={0.5} flexWrap="wrap">
                                  <Badge
                                    fontSize="9px"
                                    colorScheme={entry.scheduleType === 'DAILY' ? 'blue' : 'purple'}
                                    variant="subtle"
                                    px={1}
                                    py={0}
                                  >
                                    {entry.scheduleType === 'DAILY' ? 'D' : 'W'}
                                  </Badge>
                                </HStack>
                              </Box>
                            </Tooltip>
                          );
                        })
                      )}
                    </VStack>
                  </Box>
                );
              })}
            </Flex>
          </Box>

          {/* Legend */}
          <HStack spacing={4} mt={5} pt={4} borderTop="1px solid" borderColor="gray.700" flexWrap="wrap">
            <Text fontSize="xs" color="gray.500">
              Legend:
            </Text>
            <HStack spacing={1}>
              <Badge colorScheme="blue" fontSize="xs" variant="subtle">
                D
              </Badge>
              <Text fontSize="xs" color="gray.400">
                Daily
              </Text>
            </HStack>
            <HStack spacing={1}>
              <Badge colorScheme="purple" fontSize="xs" variant="subtle">
                W
              </Badge>
              <Text fontSize="xs" color="gray.400">
                Weekly
              </Text>
            </HStack>
            <HStack spacing={1}>
              <Box w={2.5} h={2.5} borderRadius="sm" bg="blue.600" border="2px solid" borderColor="blue.400" />
              <Text fontSize="xs" color="gray.400">
                Today
              </Text>
            </HStack>
          </HStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
