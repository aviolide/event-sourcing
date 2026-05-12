import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';

import { KafkaEnvelope, createEnvelope } from './kafka-envelope';
import { TopicName } from './kafka-topics';

export interface PublishParams<T> {
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
export class KafkaProducerService implements OnModuleInit {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
    this.logger.log('Kafka producer connected');
  }

  async publish<T>(params: PublishParams<T>): Promise<KafkaEnvelope<T>> {
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

    this.logger.log(
      `Publishing to ${params.topic}: messageId=${envelope.messageId}`,
    );

    this.kafkaClient.emit(params.topic, envelope);

    return envelope;
  }
}
