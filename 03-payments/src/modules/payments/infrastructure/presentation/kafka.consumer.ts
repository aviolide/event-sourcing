import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';

import { PaymentsApplication } from '../../application/payments.application';
import { InboxGuard } from '@yupi/messaging';

@Controller()
export class PaymentsKafkaConsumer {
  private readonly logger = new Logger(PaymentsKafkaConsumer.name);

  constructor(
    @Inject(PaymentsApplication)
    private readonly application: PaymentsApplication,
    private readonly inboxGuard: InboxGuard,
  ) {}

  @EventPattern('evt.wallet.debited')
  async handleWalletDebited(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, 'evt.wallet.debited', async () => {
      this.logger.log(
        `Received evt.wallet.debited for requestId=${payload.transferId || payload.requestId}`,
      );

      // Mark payment as completed when debit succeeds
      const paymentId = payload.transferId || payload.requestId;
      if (paymentId) {
        const result = await this.application.updatePaymentStatus(paymentId, 'COMPLETED');
        if (result.isErr()) {
          this.logger.error(
            `Error updating payment ${paymentId} -> COMPLETED: ${result.error.message}`,
            result.error.stack,
          );
        }
      }
    });
  }

  @EventPattern('evt.wallet.credited')
  async handleWalletCredited(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, 'evt.wallet.credited', async () => {
      this.logger.log(
        `Received evt.wallet.credited for walletId=${payload.walletId}`,
      );
    });
  }

  @EventPattern('evt.payment.failed')
  async handlePaymentFailed(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, 'evt.payment.failed', async () => {
      this.logger.log(
        `Received evt.payment.failed for requestId=${payload.requestId} reason=${payload.reason}`,
      );

      const paymentId = payload.requestId;
      if (paymentId) {
        const result = await this.application.updatePaymentStatus(paymentId, 'FAILED');
        if (result.isErr()) {
          this.logger.error(
            `Error updating payment ${paymentId} -> FAILED: ${result.error.message}`,
            result.error.stack,
          );
        }
      }
    });
  }
}
