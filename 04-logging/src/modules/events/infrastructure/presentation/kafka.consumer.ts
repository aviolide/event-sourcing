import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { EventLogApplication } from '../../application/event-log.application';
import { Topics, ALL_TOPICS } from '@yupi/messaging';

@Controller()
export class EventsKafkaConsumer {
  private readonly logger = new Logger(EventsKafkaConsumer.name);

  constructor(private readonly application: EventLogApplication) {}

  @EventPattern(Topics.EVT_USER_CREATED)
  async onUserCreated(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_USER_CREATED, data, context);
  }

  @EventPattern(Topics.EVT_WALLET_CREATED)
  async onWalletCreated(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_CREATED, data, context);
  }

  @EventPattern(Topics.EVT_WALLET_DEBITED)
  async onWalletDebited(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_DEBITED, data, context);
  }

  @EventPattern(Topics.EVT_WALLET_CREDITED)
  async onWalletCredited(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_CREDITED, data, context);
  }

  @EventPattern(Topics.EVT_PAYMENT_CREATED)
  async onPaymentCreated(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_PAYMENT_CREATED, data, context);
  }

  @EventPattern(Topics.EVT_PAYMENT_COMPLETED)
  async onPaymentCompleted(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_PAYMENT_COMPLETED, data, context);
  }

  @EventPattern(Topics.EVT_PAYMENT_FAILED)
  async onPaymentFailed(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_PAYMENT_FAILED, data, context);
  }

  private async handleEvent(
    topic: string,
    data: Record<string, unknown>,
    context: KafkaContext,
  ) {
    const key = context.getMessage().key?.toString() ?? null;
    this.logger.log(`Received event: topic=${topic} key=${key}`);

    try {
      await this.application.append(topic, data);
    } catch (err) {
      this.logger.error(
        `Failed to persist event: topic=${topic}`,
        (err as Error).stack,
      );
    }
  }
}
