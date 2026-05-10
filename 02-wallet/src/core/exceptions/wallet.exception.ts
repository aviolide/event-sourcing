import { BaseException } from './base.exception';
import { ErrorMessage } from './message.exception';

export class WalletSaveDatabaseException extends BaseException {
  status = 500;

  constructor(message: string, stack?: string) {
    super(message, stack);
    this.name = ErrorMessage.WALLET_SAVE_DATABASE_EXCEPTION;
  }
}

export class WalletGetDatabaseException extends BaseException {
  status = 500;

  constructor(message: string, stack?: string) {
    super(message, stack);
    this.name = ErrorMessage.WALLET_GET_DATABASE_EXCEPTION;
  }
}

export class WalletNotFoundException extends BaseException {
  status = 404;

  constructor(userId: string) {
    super(`Wallet for userId ${userId} not found`);
    this.name = ErrorMessage.WALLET_NOT_FOUND_EXCEPTION;
  }
}

export class WalletInsufficientFundsException extends BaseException {
  status = 400;

  constructor(message: string, stack?: string) {
    super(message, stack);
    this.name = 'WALLET_INSUFFICIENT_FUNDS';
  }
}

export class WalletTransferDatabaseException extends BaseException {
  status = 500;

  constructor(message: string, stack?: string) {
    super(message, stack);
    this.name = 'WALLET_TRANSFER_DATABASE_EXCEPTION';
  }
}
