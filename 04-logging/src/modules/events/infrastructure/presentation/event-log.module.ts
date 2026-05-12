import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventLogEntity } from '../entities/event-log.entity';
import { EventLogApplication } from '../../application/event-log.application';
import { EventsKafkaConsumer } from './kafka.consumer';
import { SseController } from './sse.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventLogEntity])],
  controllers: [SseController, EventsKafkaConsumer],
  providers: [EventLogApplication],
  exports: [EventLogApplication],
})
export class EventLogModule {}
