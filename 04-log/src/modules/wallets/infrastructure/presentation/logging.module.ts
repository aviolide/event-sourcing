import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoggingEntity } from '../entities/logging.entity';
import { LoggingInfrastructure } from '../logging.infrastructure';
import { LoggingRepository } from '../../domain/repositories/logging.repository';
import { LoggingApplication } from '../../application/logging.application';
import { LoggingKafkaConsumer } from './kafka.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([LoggingEntity])],
  controllers: [LoggingController, LoggingKafkaConsumer],
  providers: [
    LoggingInfrastructure,
    LoggingApplication,
    {
      provide: LoggingRepository,
      useExisting: LoggingInfrastructure,
    },
  ],
  exports: [LoggingApplication, LoggingRepository],
})
export class LoggingModule {}
