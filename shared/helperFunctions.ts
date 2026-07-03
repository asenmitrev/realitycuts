import { ErrorWithMessage } from './types';

export const isErrorWithMessage = function (error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string' &&
    typeof (error as Record<string, unknown>).name === 'string'
  );
};
