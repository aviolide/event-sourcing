import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { EventLogApplication } from '../../application/event-log.application';
import { Topics } from '@yupi/messaging';

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

  @EventPattern(Topics.EVT_WALLET_RESERVED)
  async onWalletReserved(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_RESERVED, data, context);
  }

  @EventPattern(Topics.EVT_WALLET_RESERVE_FAILED)
  async onWalletReserveFailed(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_RESERVE_FAILED, data, context);
  }

  @EventPattern(Topics.EVT_WALLET_CREDITED)
  async onWalletCredited(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_CREDITED, data, context);
  }

  @EventPattern(Topics.EVT_WALLET_CREDIT_FAILED)
  async onWalletCreditFailed(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_CREDIT_FAILED, data, context);
  }

  @EventPattern(Topics.EVT_WALLET_COMMITTED)
  async onWalletCommitted(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_COMMITTED, data, context);
  }

  @EventPattern(Topics.EVT_WALLET_COMMIT_FAILED)
  async onWalletCommitFailed(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_COMMIT_FAILED, data, context);
  }

  @EventPattern(Topics.EVT_WALLET_RELEASED)
  async onWalletReleased(
    @Payload() data: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    await this.handleEvent(Topics.EVT_WALLET_RELEASED, data, context);
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
