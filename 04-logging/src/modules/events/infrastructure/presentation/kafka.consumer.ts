import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';

import { EventLogApplication } from '../../application/event-log.application';

@Controller()
export class EventsKafkaConsumer {
  private readonly logger = new Logger(EventsKafkaConsumer.name);

  constructor(private readonly application: EventLogApplication) {}

  @EventPattern('user.created')
  async onUserCreated(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent('user.created', data, context);
  }

  @EventPattern('wallet.transfer.requested')
  async onWalletTransferRequested(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent('wallet.transfer.requested', data, context);
  }

  @EventPattern('wallet.transfer.processed')
  async onWalletTransferProcessed(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent('wallet.transfer.processed', data, context);
  }

  @EventPattern('payment.created')
  async onPaymentCreated(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent('payment.created', data, context);
  }

  @EventPattern('payment.completed')
  async onPaymentCompleted(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent('payment.completed', data, context);
  }

  @EventPattern('payment.failed')
  async onPaymentFailed(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent('payment.failed', data, context);
  }

  private async handleEvent(
    topic: string,
    data: Record<string, unknown>,
    context: KafkaContext,
  ) {
    const key = context.getMessage().key?.toString() ?? null;
    this.logger.log(`Received event: topic=${topic} key=${key}`);

    try {
      await this.application.append(topic, key, data);
    } catch (err) {
      this.logger.error(
        `Failed to persist event: topic=${topic}`,
        (err as Error).stack,
      );
    }
  }
}
