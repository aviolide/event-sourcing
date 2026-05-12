import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { SagaService } from './saga.service';
import { InboxGuard, Topics } from '@yupi/messaging';

@Controller()
export class SagaConsumer {
  private readonly logger = new Logger(SagaConsumer.name);

  constructor(
    @Inject(SagaService)
    private readonly sagaService: SagaService,
    private readonly inboxGuard: InboxGuard,
  ) {}

  @EventPattern(Topics.CMD_PAYMENT_TRANSFER_CREATE)
  async handlePaymentTransferCreate(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.CMD_PAYMENT_TRANSFER_CREATE, async () => {
      this.logger.log(
        `Received cmd.payment.transfer.create requestId=${payload.requestId}`,
      );

      await this.sagaService.startTransferSaga({
        requestId: payload.requestId,
        fromUserId: payload.fromUserId,
        toUserId: payload.toUserId,
        amount: payload.amount,
        currency: payload.currency,
        description: payload.description,
        correlationId: envelope.correlationId,
      });
    });
  }

  @EventPattern(Topics.EVT_WALLET_RESERVED)
  async handleWalletReserved(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_RESERVED, async () => {
      await this.sagaService.onWalletReserved(
        payload.requestId || payload.transferId,
        envelope.correlationId,
      );
    });
  }

  @EventPattern(Topics.EVT_WALLET_RESERVE_FAILED)
  async handleWalletReserveFailed(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_RESERVE_FAILED, async () => {
      await this.sagaService.onWalletReserveFailed(
        payload.requestId || payload.transferId,
        payload.reason || 'Reserve failed',
        envelope.correlationId,
      );
    });
  }

  @EventPattern(Topics.EVT_WALLET_CREDITED)
  async handleWalletCredited(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_CREDITED, async () => {
      await this.sagaService.onWalletCredited(
        payload.requestId || payload.transferId,
        envelope.correlationId,
      );
    });
  }

  @EventPattern(Topics.EVT_WALLET_CREDIT_FAILED)
  async handleWalletCreditFailed(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_CREDIT_FAILED, async () => {
      await this.sagaService.onWalletCreditFailed(
        payload.requestId || payload.transferId,
        payload.reason || 'Credit failed',
        envelope.correlationId,
      );
    });
  }

  @EventPattern(Topics.EVT_WALLET_COMMITTED)
  async handleWalletCommitted(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_COMMITTED, async () => {
      await this.sagaService.onWalletCommitted(
        payload.requestId || payload.transferId,
        envelope.correlationId,
      );
    });
  }

  @EventPattern(Topics.EVT_WALLET_RELEASED)
  async handleWalletReleased(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_RELEASED, async () => {
      await this.sagaService.onWalletReleased(
        payload.requestId || payload.transferId,
        envelope.correlationId,
      );
    });
  }
}
