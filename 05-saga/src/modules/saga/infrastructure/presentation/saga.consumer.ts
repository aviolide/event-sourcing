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

  @EventPattern(Topics.EVT_WALLET_DEBITED)
  async handleWalletDebited(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_WALLET_DEBITED, async () => {
      const sagaId = payload.transferId || payload.requestId;
      if (!sagaId) {
        this.logger.warn('Missing sagaId in wallet.debited event');
        return;
      }

      await this.sagaService.onWalletDebited(
        sagaId,
        payload,
        envelope.correlationId,
      );
    });
  }

  @EventPattern(Topics.EVT_PAYMENT_FAILED)
  async handlePaymentFailed(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_PAYMENT_FAILED, async () => {
      const sagaId = payload.requestId;
      if (!sagaId) {
        this.logger.warn('Missing sagaId in payment.failed event');
        return;
      }

      await this.sagaService.onWalletDebitFailed(
        sagaId,
        payload.reason || 'Unknown error',
        envelope.correlationId,
      );
    });
  }
}
