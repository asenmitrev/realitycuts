import { FC, useEffect } from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  Stack,
  Radio,
  VStack,
  HStack,
  Button,
  IconButton,
  Text,
  Select,
  Checkbox,
  useColorModeValue,
  Badge,
  Tooltip
} from '@chakra-ui/react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { FiPlus, FiTrash2, FiClock } from 'react-icons/fi';
import { AutomationConfigFormData } from '../../types';
import { getTimezoneName } from '../../utils/timezone';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Generate 12-hour format options (1-12)
const generate12HourOptions = () => {
  const options = [];
  for (let hour = 1; hour <= 12; hour++) {
    options.push({ value: hour, label: hour.toString() });
  }
  return options;
};

const generateMinuteOptions = () => {
  const options = [];
  for (let minute = 0; minute < 60; minute += 5) {
    options.push({ value: minute, label: minute.toString().padStart(2, '0') });
  }
  return options;
};

// Generate AM/PM options
const generateAmPmOptions = () => [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' }
];

// Convert 24-hour format to 12-hour format with AM/PM
const convertTo12Hour = (hour24: number): { hour: number; period: 'AM' | 'PM' } => {
  if (hour24 === 0) {
    return { hour: 12, period: 'AM' };
  } else if (hour24 < 12) {
    return { hour: hour24, period: 'AM' };
  } else if (hour24 === 12) {
    return { hour: 12, period: 'PM' };
  } else {
    return { hour: hour24 - 12, period: 'PM' };
  }
};

// Convert 12-hour format with AM/PM to 24-hour format
const convertTo24Hour = (hour12: number, period: 'AM' | 'PM'): number => {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12;
  } else {
    return hour12 === 12 ? 12 : hour12 + 12;
  }
};

interface ScheduleSelectorProps {
  canCreateDaily?: boolean;
  canCreateWeekly?: boolean;
  isEdit?: boolean;
}

export const ScheduleSelector: FC<ScheduleSelectorProps> = ({
  canCreateDaily = true,
  canCreateWeekly = true,
  isEdit = false
}) => {
  const { control, watch, setValue } = useFormContext<AutomationConfigFormData>();
  const bgColor = useColorModeValue('whiteAlpha.100', 'whiteAlpha.100');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('white', 'white');
  const scheduleType = watch('schedule.type');
  const hour12Options = generate12HourOptions();
  const minuteOptions = generateMinuteOptions();
  const amPmOptions = generateAmPmOptions();

  // Auto-select weekly when only weekly is allowed (for new automations)
  useEffect(() => {
    if (!isEdit && !canCreateDaily && canCreateWeekly && scheduleType !== 'WEEKLY') {
      setValue('schedule.type', 'WEEKLY');
    }
  }, [canCreateDaily, canCreateWeekly, isEdit, scheduleType, setValue]);

  const {
    fields: dailyTimes,
    append: addDailyTime,
    remove: removeDailyTime
  } = useFieldArray({
    control,
    name: 'schedule.dailyTimes'
  });

  return (
    <Box>
      {/* Timezone indicator */}
      <HStack justify="space-between" align="center" mb={4}>
        <Text color="gray.400" fontSize="sm">
          All times are shown in your local timezone
        </Text>
        <Badge colorScheme="blue" variant="outline" fontSize="xs" px={2} py={1}>
          <HStack spacing={1}>
            <FiClock size={12} />
            <Text>{getTimezoneName()}</Text>
          </HStack>
        </Badge>
      </HStack>

      <FormControl mb={6}>
        <FormLabel color={textColor} fontSize="lg" fontWeight="bold">
          Schedule Type
        </FormLabel>
        <Controller
          name="schedule.type"
          control={control}
          render={({ field }) => (
            <RadioGroup onChange={field.onChange} value={field.value}>
              <Stack direction="row" spacing={8}>
                <Tooltip
                  label={!canCreateDaily ? 'You have reached your daily automation limit.' : ''}
                  isDisabled={isEdit || canCreateDaily}
                >
                  <Radio colorScheme="blue" value="DAILY" size="lg" isDisabled={!isEdit && !canCreateDaily}>
                    <Text fontSize="md" color={!isEdit && !canCreateDaily ? 'gray.400' : textColor}>
                      Daily
                    </Text>
                  </Radio>
                </Tooltip>
                <Tooltip
                  label={!canCreateWeekly ? 'You have reached your weekly automation limit.' : ''}
                  isDisabled={isEdit || canCreateWeekly}
                >
                  <Radio colorScheme="blue" value="WEEKLY" size="lg" isDisabled={!isEdit && !canCreateWeekly}>
                    <Text fontSize="md" color={!isEdit && !canCreateWeekly ? 'gray.400' : textColor}>
                      Weekly
                    </Text>
                  </Radio>
                </Tooltip>
              </Stack>
            </RadioGroup>
          )}
        />
      </FormControl>

      {scheduleType === 'DAILY' && (
        <Box>
          <HStack justify="space-between" mb={6}>
            <VStack align="flex-start" spacing={1}>
              <Text color={textColor} fontSize="xl" fontWeight="bold">
                Daily Times
              </Text>
              <Text color="gray.400" fontSize="sm">
                Configure when your content should be published each day
              </Text>
            </VStack>
            <Button
              leftIcon={<FiPlus />}
              variant="solid"
              bg="rgba(255, 255, 255, 0.1)"
              color="white"
              borderRadius="lg"
              _hover={{ bg: 'rgba(255, 255, 255, 0.2)' }}
              _active={{ bg: 'rgba(255, 255, 255, 0.15)' }}
              onClick={() =>
                addDailyTime({
                  hour: 9,
                  minute: 0
                })
              }
            >
              Add Time
            </Button>
          </HStack>

          <VStack spacing={4} align="stretch">
            {dailyTimes.map((field, index) => (
              <Box
                key={field.id}
                bg="rgba(255, 255, 255, 0.05)"
                borderRadius="xl"
                p={4}
                border="1px solid"
                borderColor="rgba(255, 255, 255, 0.1)"
              >
                <HStack spacing={4} align="center">
                  <Box
                    bg="rgba(255, 255, 255, 0.1)"
                    borderRadius="full"
                    w={10}
                    h={10}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    <Text color="white" fontSize="sm" fontWeight="medium">
                      #{index + 1}
                    </Text>
                  </Box>

                  <HStack spacing={2} flex={1}>
                    <Controller
                      name={`schedule.dailyTimes.${index}.hour`}
                      control={control}
                      render={({ field: hourField }) => {
                        const { hour } = convertTo12Hour(hourField.value || 9);
                        return (
                          <Select
                            value={hour}
                            onChange={e => {
                              const newHour12 = Number(e.target.value);
                              const currentPeriod = convertTo12Hour(hourField.value || 9).period;
                              const newHour24 = convertTo24Hour(newHour12, currentPeriod);
                              hourField.onChange(newHour24);
                            }}
                            bg="rgba(255, 255, 255, 0.1)"
                            borderColor="rgba(255, 255, 255, 0.2)"
                            color="white"
                            borderRadius="lg"
                            _hover={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                            _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                            minW="70px"
                          >
                            {hour12Options.map(option => (
                              <option
                                key={option.value}
                                value={option.value}
                                style={{ backgroundColor: '#2D3748', color: 'white' }}
                              >
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        );
                      }}
                    />

                    <Text color="white" fontSize="lg" fontWeight="medium">
                      :
                    </Text>

                    <Controller
                      name={`schedule.dailyTimes.${index}.minute`}
                      control={control}
                      render={({ field: minuteField }) => (
                        <Select
                          value={minuteField.value}
                          onChange={e => minuteField.onChange(Number(e.target.value))}
                          bg="rgba(255, 255, 255, 0.1)"
                          borderColor="rgba(255, 255, 255, 0.2)"
                          color="white"
                          borderRadius="lg"
                          _hover={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                          _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                          minW="70px"
                        >
                          {minuteOptions.map(option => (
                            <option
                              key={option.value}
                              value={option.value}
                              style={{ backgroundColor: '#2D3748', color: 'white' }}
                            >
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    />

                    <Controller
                      name={`schedule.dailyTimes.${index}.hour`}
                      control={control}
                      render={({ field: hourField }) => {
                        const { period } = convertTo12Hour(hourField.value || 9);
                        return (
                          <Select
                            value={period}
                            onChange={e => {
                              const newPeriod = e.target.value as 'AM' | 'PM';
                              const currentHour12 = convertTo12Hour(hourField.value || 9).hour;
                              const newHour24 = convertTo24Hour(currentHour12, newPeriod);
                              hourField.onChange(newHour24);
                            }}
                            bg="rgba(255, 255, 255, 0.1)"
                            borderColor="rgba(255, 255, 255, 0.2)"
                            color="white"
                            borderRadius="lg"
                            _hover={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}
                            _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                            minW="70px"
                          >
                            {amPmOptions.map(option => (
                              <option
                                key={option.value}
                                value={option.value}
                                style={{ backgroundColor: '#2D3748', color: 'white' }}
                              >
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        );
                      }}
                    />
                  </HStack>

                  <IconButton
                    aria-label="Remove time"
                    icon={<FiTrash2 />}
                    size="md"
                    variant="ghost"
                    color="red.400"
                    bg="rgba(255, 0, 0, 0.1)"
                    borderRadius="lg"
                    _hover={{ bg: 'rgba(255, 0, 0, 0.2)' }}
                    _active={{ bg: 'rgba(255, 0, 0, 0.15)' }}
                    onClick={() => removeDailyTime(index)}
                    isDisabled={dailyTimes.length === 1}
                  />
                </HStack>
              </Box>
            ))}
          </VStack>

          {dailyTimes.length === 0 && (
            <Box
              bg="rgba(255, 255, 255, 0.05)"
              borderRadius="xl"
              p={8}
              border="1px solid"
              borderColor="rgba(255, 255, 255, 0.1)"
              textAlign="center"
            >
              <Text color="gray.400" fontSize="sm">
                Click "Add Time" to schedule daily automation times
              </Text>
            </Box>
          )}
        </Box>
      )}

      {scheduleType === 'WEEKLY' && (
        <VStack spacing={4} align="stretch">
          <Box p={4} borderRadius="xl" bg={bgColor} borderWidth="1px" borderColor={borderColor}>
            <Text color={textColor} fontSize="md" fontWeight="medium" mb={3}>
              Days of Week
            </Text>
            <Controller
              name="schedule.weeklyDays"
              control={control}
              render={({ field }) => (
                <Stack direction="row" spacing={4} flexWrap="wrap">
                  {weekdays.map((day, index) => (
                    <Checkbox
                      key={day}
                      colorScheme="blue"
                      isChecked={field.value?.includes(index) || false}
                      onChange={e => {
                        const current = field.value || [];
                        if (e.target.checked) {
                          field.onChange([...current, index]);
                        } else {
                          field.onChange(current.filter((d: number) => d !== index));
                        }
                      }}
                    >
                      <Text fontSize="sm">{day}</Text>
                    </Checkbox>
                  ))}
                </Stack>
              )}
            />
          </Box>

          <Box p={4} borderRadius="xl" bg={bgColor} borderWidth="1px" borderColor={borderColor}>
            <Text color={textColor} fontSize="md" fontWeight="medium" mb={3}>
              Time
            </Text>
            <HStack spacing={2} maxW="250px">
              <Controller
                name="schedule.weeklyTime.hour"
                control={control}
                render={({ field: hourField }) => {
                  const { hour } = convertTo12Hour(hourField.value || 9);
                  return (
                    <Select
                      value={hour}
                      onChange={e => {
                        const newHour12 = Number(e.target.value);
                        const currentPeriod = convertTo12Hour(hourField.value || 9).period;
                        const newHour24 = convertTo24Hour(newHour12, currentPeriod);
                        hourField.onChange(newHour24);
                      }}
                      bg="whiteAlpha.100"
                      borderColor="whiteAlpha.200"
                      _hover={{ borderColor: 'blue.400' }}
                      _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                      minW="70px"
                    >
                      {hour12Options.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  );
                }}
              />
              <Text color={textColor} fontSize="sm">
                :
              </Text>
              <Controller
                name="schedule.weeklyTime.minute"
                control={control}
                render={({ field: minuteField }) => (
                  <Select
                    value={minuteField.value || 0}
                    onChange={e => minuteField.onChange(Number(e.target.value))}
                    bg="whiteAlpha.100"
                    borderColor="whiteAlpha.200"
                    _hover={{ borderColor: 'blue.400' }}
                    _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                    minW="70px"
                  >
                    {minuteOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              />
              <Controller
                name="schedule.weeklyTime.hour"
                control={control}
                render={({ field: hourField }) => {
                  const { period } = convertTo12Hour(hourField.value || 9);
                  return (
                    <Select
                      value={period}
                      onChange={e => {
                        const newPeriod = e.target.value as 'AM' | 'PM';
                        const currentHour12 = convertTo12Hour(hourField.value || 9).hour;
                        const newHour24 = convertTo24Hour(currentHour12, newPeriod);
                        hourField.onChange(newHour24);
                      }}
                      bg="whiteAlpha.100"
                      borderColor="whiteAlpha.200"
                      _hover={{ borderColor: 'blue.400' }}
                      _focus={{ borderColor: 'blue.400', boxShadow: 'none' }}
                      minW="70px"
                    >
                      {amPmOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  );
                }}
              />
            </HStack>
          </Box>
        </VStack>
      )}
    </Box>
  );
};
