import { AppError } from './AppError';

export class InternalServerError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}
