import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';

import { PaymentsApplication } from '../../application/payments.application';
import { InboxGuard, Topics } from '@yupi/messaging';

@Controller()
export class PaymentsKafkaConsumer {
  private readonly logger = new Logger(PaymentsKafkaConsumer.name);

  constructor(
    @Inject(PaymentsApplication)
    private readonly application: PaymentsApplication,
    private readonly inboxGuard: InboxGuard,
  ) {}

  @EventPattern(Topics.EVT_PAYMENT_COMPLETED)
  async handlePaymentCompleted(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.EVT_PAYMENT_COMPLETED, async () => {
      this.logger.log(
        `Received evt.payment.completed for requestId=${payload.requestId}`,
      );

      const result = await this.application.updatePaymentStatus(payload.requestId, 'COMPLETED');
      if (result.isErr()) {
        this.logger.error(
          `Error updating payment ${payload.requestId} -> COMPLETED: ${result.error.message}`,
          result.error.stack,
        );
      }
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
      this.logger.log(
        `Received evt.payment.failed for requestId=${payload.requestId} reason=${payload.reason}`,
      );

      const result = await this.application.updatePaymentStatus(payload.requestId, 'FAILED');
      if (result.isErr()) {
        this.logger.error(
          `Error updating payment ${payload.requestId} -> FAILED: ${result.error.message}`,
          result.error.stack,
        );
      }
    });
  }
}
