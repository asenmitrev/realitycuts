import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { IS_PROD } from '../config/const';

winston.add(
  new winston.transports.Console({
    level: IS_PROD ? 'info' : 'debug'
  })
);

// File transport with daily rotation
winston.add(
  new DailyRotateFile({
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info'
  })
);

export const logger = winston;
