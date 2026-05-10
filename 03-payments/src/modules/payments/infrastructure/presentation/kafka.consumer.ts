import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { PaymentsApplication } from '../../application/payments.application';

type WalletTransferProcessedEvent = {
  paymentId: string;
  status: 'COMPLETED' | 'FAILED';
  reason?: string;
};

@Controller()
export class PaymentsKafkaConsumer {
  private readonly logger = new Logger(PaymentsKafkaConsumer.name);

  constructor(
    @Inject(PaymentsApplication)
    private readonly application: PaymentsApplication,
  ) {}

  @EventPattern('wallet.transfer.processed')
  async handleWalletTransferProcessed(
    @Payload() message: WalletTransferProcessedEvent,
  ) {
    this.logger.log(
      `Received wallet.transfer.processed for paymentId=${message.paymentId} status=${message.status}`,
    );

    const result = await this.application.updatePaymentStatus(
      message.paymentId,
      message.status,
    );

    if (result.isErr()) {
      this.logger.error(
        `Error updating payment ${message.paymentId} -> ${message.status}: ${result.error.message}`,
        result.error.stack,
      );
    }
  }
}