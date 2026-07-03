// Timezone conversion utilities for automation schedules

export interface TimeObject {
  hour: number;
  minute: number;
}

/**
 * Converts local time to UTC time
 * @param localTime - Time in user's local timezone
 * @returns Time converted to UTC
 */
export const convertLocalTimeToUTC = (localTime: TimeObject): TimeObject => {
  // Create a date object for today with the local time
  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), localTime.hour, localTime.minute, 0, 0);

  // Get UTC equivalent
  const utcHour = localDate.getUTCHours();
  const utcMinute = localDate.getUTCMinutes();

  return {
    hour: utcHour,
    minute: utcMinute
  };
};

/**
 * Converts UTC time to local time
 * @param utcTime - Time in UTC
 * @returns Time converted to user's local timezone
 */
export const convertUTCTimeToLocal = (utcTime: TimeObject): TimeObject => {
  // Create a UTC date object
  const now = new Date();
  const utcDate = new Date();
  utcDate.setUTCFullYear(now.getFullYear());
  utcDate.setUTCMonth(now.getMonth());
  utcDate.setUTCDate(now.getDate());
  utcDate.setUTCHours(utcTime.hour);
  utcDate.setUTCMinutes(utcTime.minute);
  utcDate.setUTCSeconds(0);
  utcDate.setUTCMilliseconds(0);

  // Get local equivalent
  const localHour = utcDate.getHours();
  const localMinute = utcDate.getMinutes();

  return {
    hour: localHour,
    minute: localMinute
  };
};

/**
 * Converts an array of daily times from local to UTC
 */
export const convertDailyTimesToUTC = (dailyTimes: TimeObject[]): TimeObject[] => {
  return dailyTimes.map(convertLocalTimeToUTC);
};

/**
 * Converts an array of daily times from UTC to local
 */
export const convertDailyTimesToLocal = (dailyTimes: TimeObject[]): TimeObject[] => {
  return dailyTimes.map(convertUTCTimeToLocal);
};

/**
 * Gets the user's timezone offset in minutes
 */
export const getTimezoneOffset = (): number => {
  return new Date().getTimezoneOffset();
};

/**
 * Gets the user's timezone name
 */
export const getTimezoneName = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};
