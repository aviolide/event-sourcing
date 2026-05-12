import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { ProjectionsService } from './projections.service';
import { InboxGuard, Topics } from '@yupi/messaging';

@Controller()
export class ProjectionsConsumer {
  private readonly logger = new Logger(ProjectionsConsumer.name);

  constructor(
    @Inject(ProjectionsService)
    private readonly projectionsService: ProjectionsService,
    private readonly inboxGuard: InboxGuard,
  ) {}

  @EventPattern(Topics.EVT_WALLET_CREATED)
  async onWalletCreated(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_CREATED, async () => {
      await this.projectionsService.onWalletCreated(envelope.payload);
    });
  }

  @EventPattern(Topics.EVT_WALLET_CREDITED)
  async onWalletCredited(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_CREDITED, async () => {
      await this.projectionsService.onWalletCredited(envelope.payload);
    });
  }

  @EventPattern(Topics.EVT_WALLET_COMMITTED)
  async onWalletCommitted(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_COMMITTED, async () => {
      await this.projectionsService.onWalletCommitted(envelope.payload);
    });
  }

  @EventPattern(Topics.EVT_PAYMENT_COMPLETED)
  async onPaymentCompleted(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_PAYMENT_COMPLETED, async () => {
      await this.projectionsService.onPaymentStatusUpdated({
        paymentId: envelope.payload.requestId,
        status: 'COMPLETED',
      });
    });
  }

  @EventPattern(Topics.EVT_PAYMENT_FAILED)
  async onPaymentFailed(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_PAYMENT_FAILED, async () => {
      await this.projectionsService.onPaymentStatusUpdated({
        paymentId: envelope.payload.requestId,
        status: 'FAILED',
      });
    });
  }
}
