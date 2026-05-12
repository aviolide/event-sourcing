import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { LoggingApplication } from '../../application/logging.application';

type UserCreatedEvent = {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
};

@Controller()
export class LoggingKafkaConsumer {
  private readonly logger = new Logger(LoggingKafkaConsumer.name);

  constructor(
    @Inject(LoggingApplication)
    private readonly application: LoggingApplication,
  ) {}

  @EventPattern('user.created')
  async handleUserCreated(@Payload() message: UserCreatedEvent) {
    this.logger.log(`Received user.created event for userId=${message.id}`);

    const result = await this.application.createForUser(message.id);

    if (result.isErr()) {
      this.logger.error(
        `Error creating logging for userId=${message.id}: ${result.error.message}`,
        result.error.stack,
      );
    } else {
      const logging = result.value.properties();
      this.logger.log(
        `Logging created for userId=${message.id} loggingId=${logging.id}`,
      );
    }
  }
}
