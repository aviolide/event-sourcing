import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class PaymentsKafkaProducer implements OnModuleInit {
  private readonly logger = new Logger(PaymentsKafkaProducer.name);

  constructor(
    @Inject('PAYMENTS_KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
    this.logger.log('Kafka producer (Payments) connected ✔');
  }

  async emitWalletTransferRequested(payload: {
    paymentId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }): Promise<void> {
    this.logger.log(
      `Emitting wallet.transfer.requested: ${JSON.stringify(payload)}`,
    );

    this.kafkaClient.emit('wallet.transfer.requested', payload);
  }
}