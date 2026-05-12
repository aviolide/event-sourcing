import { Inject, Injectable } from '@nestjs/common';
import { LoggingRepository, LoggingTransferResult } from '../domain/repositories/logging.repository';

@Injectable()
export class LoggingApplication {
  constructor(
    @Inject(LoggingRepository)
    private readonly repository: LoggingRepository,
  ) {}

}
