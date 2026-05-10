import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaProducer implements OnModuleInit {
  private readonly logger = new Logger(KafkaProducer.name);

  constructor(
    @Inject('AUTH_KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // NestJS needs this to initialize producer
    await this.kafkaClient.connect();
    this.logger.log('Kafka producer connected ✔');
  }

  async emitUserCreated(payload: {
    id: string;
    email?: string;
    phone?: string;
    fullName?: string;
  }): Promise<void> {
    this.logger.log(`Emitting user.created event: ${JSON.stringify(payload)}`);

    this.kafkaClient.emit('user.created', payload);
  }

}
