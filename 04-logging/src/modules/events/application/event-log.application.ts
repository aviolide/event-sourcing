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
    key: string | null,
    payload: Record<string, unknown>,
  ): Promise<EventLog> {
    const entity = this.repo.create({ topic, key, payload });
    const saved = await this.repo.save(entity);

    this.logger.log(`Event persisted: topic=${topic} id=${saved.id}`);

    const event: EventLog = {
      id: saved.id,
      topic: saved.topic,
      key: saved.key,
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

  subscribe() {
    return this.eventStream$.asObservable();
  }
}
