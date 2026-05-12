import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'rxjs';

import { EventLogEntity } from '../infrastructure/entities/event-log.entity';
import { EventLog } from '../domain/event-log';

@Injectable()
export class EventLogApplication {
  private readonly logger = new Logger(EventLogApplication.name);
  private readonly eventStream$ = new Subject<EventLog>();

  constructor(
    @InjectRepository(EventLogEntity)
    private readonly repo: Repository<EventLogEntity>,
  ) {}

  async append(
    topic: string,
    envelope: Record<string, unknown>,
  ): Promise<EventLog> {
    const entity = this.repo.create({
      topic,
      messageId: (envelope.messageId as string) || null,
      correlationId: (envelope.correlationId as string) || null,
      causationId: (envelope.causationId as string) || null,
      aggregateId: (envelope.aggregateId as string) || null,
      aggregateType: (envelope.aggregateType as string) || null,
      aggregateVersion: (envelope.aggregateVersion as number) || null,
      producer: (envelope.producer as string) || null,
      payload: (envelope.payload as Record<string, unknown>) || envelope,
    });

    const saved = await this.repo.save(entity);

    this.logger.log(`Event persisted: topic=${topic} id=${saved.id} correlationId=${saved.correlationId}`);

    const event: EventLog = {
      id: saved.id,
      topic: saved.topic,
      key: saved.aggregateId,
      payload: saved.payload,
      receivedAt: saved.receivedAt,
    };

    this.eventStream$.next(event);
    return event;
  }

  async findAll(limit = 50): Promise<EventLog[]> {
    return this.repo.find({
      order: { receivedAt: 'DESC' },
      take: limit,
    });
  }

  async findByCorrelationId(correlationId: string): Promise<EventLog[]> {
    return this.repo.find({
      where: { correlationId },
      order: { receivedAt: 'ASC' },
    });
  }

  async findByAggregateId(aggregateId: string): Promise<EventLog[]> {
    return this.repo.find({
      where: { aggregateId },
      order: { receivedAt: 'ASC' },
    });
  }

  subscribe() {
    return this.eventStream$.asObservable();
  }
}
