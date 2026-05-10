import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { WalletApplication } from '../../application/wallet.application';

type UserCreatedEvent = {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
};

@Controller()
export class WalletKafkaConsumer {
  private readonly logger = new Logger(WalletKafkaConsumer.name);

  constructor(
    @Inject(WalletApplication)
    private readonly application: WalletApplication,
  ) {}

  @EventPattern('user.created')
  async handleUserCreated(@Payload() message: UserCreatedEvent) {
    this.logger.log(`Received user.created event for userId=${message.id}`);

    const result = await this.application.createForUser(message.id);

    if (result.isErr()) {
      this.logger.error(
        `Error creating wallet for userId=${message.id}: ${result.error.message}`,
        result.error.stack,
      );
    } else {
      const wallet = result.value.properties();
      this.logger.log(
        `Wallet created for userId=${message.id} walletId=${wallet.id}`,
      );
    }
  }
}
