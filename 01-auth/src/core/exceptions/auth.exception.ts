import { BaseException } from './base.exception';
import { ErrorMessage } from './message.exception';

export class UserSaveDatabaseException extends BaseException {
  status = 500;
  constructor(message: string, stack?: string) {
    super(message, stack);
    this.name = ErrorMessage.USER_SAVE_DATABASE_EXCEPTION;
  }
}

export class UserGetDatabaseException extends BaseException {
  status = 500;
  constructor(message: string, stack?: string) {
    super(message, stack);
    this.name = ErrorMessage.USER_GET_DATABASE_EXCEPTION;
  }
}

export class InvalidCredentialsException extends BaseException {
  status = 401;
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = ErrorMessage.INVALID_CREDENTIALS;
  }
}
