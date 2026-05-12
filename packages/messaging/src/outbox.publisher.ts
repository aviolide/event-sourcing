import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { OutboxEvent } from './outbox.entity';
import { KafkaEnvelope, createEnvelope } from './kafka-envelope';
import { TopicName } from './kafka-topics';
import { randomUUID } from 'node:crypto';

export interface OutboxPublishParams<T> {
  topic: TopicName;
  payload: T;
  aggregateId: string;
  aggregateType: string;
  aggregateVersion: number;
  correlationId?: string;
  causationId?: string;
  producer: string;
}

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly repository: Repository<OutboxEvent>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(OutboxEvent);
  }

  async save<T>(
    params: OutboxPublishParams<T>,
    manager?: EntityManager,
  ): Promise<KafkaEnvelope<T>> {
    const envelope = createEnvelope<T>({
      eventId: randomUUID(),
      messageId: randomUUID(),
      correlationId: params.correlationId ?? randomUUID(),
      causationId: params.causationId,
      aggregateId: params.aggregateId,
      aggregateType: params.aggregateType,
      aggregateVersion: params.aggregateVersion,
      occurredAt: new Date().toISOString(),
      producer: params.producer,
      payload: params.payload,
    });

    const repo = manager
      ? manager.getRepository(OutboxEvent)
      : this.repository;

    await repo.save(
      repo.create({
        topic: params.topic,
        aggregateId: params.aggregateId,
        aggregateType: params.aggregateType,
        envelope: envelope as unknown as Record<string, unknown>,
        sent: false,
      }),
    );

    this.logger.log(
      `Outbox saved: topic=${params.topic} aggregateId=${params.aggregateId}`,
    );

    return envelope;
  }

  async flush(kafkaClient: { emit: (topic: string, message: unknown) => void }): Promise<number> {
    const pending = await this.repository.find({
      where: { sent: false },
      order: { createdAt: 'ASC' },
      take: 100,
    });

    for (const event of pending) {
      try {
        kafkaClient.emit(event.topic, event.envelope);
        event.sent = true;
        event.sentAt = new Date();
        await this.repository.save(event);
      } catch (err) {
        this.logger.error(
          `Failed to flush outbox event ${event.id}: ${(err as Error).message}`,
        );
        break;
      }
    }

    return pending.filter((e) => e.sent).length;
  }
}
