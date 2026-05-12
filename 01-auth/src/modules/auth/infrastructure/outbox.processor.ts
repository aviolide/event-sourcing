import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxPublisher } from '@yupi/messaging';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly outboxPublisher: OutboxPublisher,
    @Inject('AUTH_KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async flushOutbox() {
    try {
      const flushed = await this.outboxPublisher.flush(this.kafkaClient);
      if (flushed > 0) {
        this.logger.log(`Flushed ${flushed} outbox events`);
      }
    } catch (err) {
      this.logger.error(`Outbox flush failed: ${(err as Error).message}`);
    }
  }
}
