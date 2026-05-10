import { BaseException } from './base.exception';
import { ErrorMessage } from './message.exception';

export class PaymentCreateDatabaseException extends BaseException {
  constructor(message: string, stack?: string) {
    super(message, stack);
    this.name = ErrorMessage.PAYMENT_CREATE_DATABASE_EXCEPTION;
    this.status = 500;
  }
}

export class PaymentUpdateDatabaseException extends BaseException {
  constructor(message: string, stack?: string) {
    super(message, stack);
    this.name = ErrorMessage.PAYMENT_UPDATE_DATABASE_EXCEPTION;
    this.status = 500;
  }
}

export class PaymentNotFoundException extends BaseException {
  constructor(message = 'Payment not found') {
    super(message);
    this.name = ErrorMessage.PAYMENT_NOT_FOUND_EXCEPTION;
    this.status = 404;
  }
}

export class PaymentDomainValidationException extends BaseException {
  constructor(message = 'Payment validation exception') {
    super(message);
    this.name = ErrorMessage.PAYMENT_NOT_FOUND_EXCEPTION;
    this.status = 400;
  }
}

export class WalletServiceException extends BaseException {
  constructor(message: string, stack?: string) {
    super(message);
    this.name = ErrorMessage.WALLET_SERVICE_EXCEPTION;
    this.status = 500;
  }
}
