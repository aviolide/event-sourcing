import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { WalletApplication } from '../../application/wallet.application';
import { KafkaProducerService, Topics, InboxGuard } from '@yupi/messaging';

@Controller()
export class WalletCommandConsumer {
  private readonly logger = new Logger(WalletCommandConsumer.name);

  constructor(
    @Inject(WalletApplication)
    private readonly application: WalletApplication,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly inboxGuard: InboxGuard,
  ) {}

  @EventPattern('user.created')
  async handleUserCreated(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const userId = envelope.payload.id || message.id;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, 'user.created', async () => {
      this.logger.log(`Received user.created for userId=${userId}`);

      const result = await this.application.createForUser(userId);

      if (result.isErr()) {
        this.logger.error(
          `Error creating wallet for userId=${userId}: ${result.error.message}`,
          result.error.stack,
        );
        return;
      }

      const wallet = result.value;

      await this.kafkaProducer.publish({
        topic: Topics.EVT_WALLET_CREATED,
        payload: {
          walletId: wallet.getId(),
          userId: wallet.getUserId(),
          currency: wallet.getCurrency(),
          initialBalance: wallet.getBalance(),
        },
        aggregateId: wallet.getId(),
        aggregateType: 'Wallet',
        aggregateVersion: 1,
        correlationId: envelope.correlationId,
        producer: 'wallet-service',
      });

      this.logger.log(
        `Wallet created for userId=${userId} walletId=${wallet.getId()}`,
      );
    });
  }

  @EventPattern(Topics.CMD_WALLET_TRANSFER)
  async handleWalletTransfer(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.CMD_WALLET_TRANSFER, async () => {
      this.logger.log(
        `Received cmd.wallet.transfer from=${payload.fromUserId} to=${payload.toUserId} amount=${payload.amount}`,
      );

      const result = await this.application.transfer(
        payload.fromUserId,
        payload.toUserId,
        payload.amount,
        payload.currency,
      );

      if (result.isErr()) {
        this.logger.error(
          `Transfer failed: ${result.error.message}`,
          result.error.stack,
        );

        await this.kafkaProducer.publish({
          topic: Topics.EVT_PAYMENT_FAILED,
          payload: {
            requestId: payload.requestId,
            reason: result.error.message,
            transferId: payload.transferId,
          },
          aggregateId: payload.requestId,
          aggregateType: 'PaymentTransfer',
          aggregateVersion: 1,
          correlationId: envelope.correlationId,
          producer: 'wallet-service',
        });
        return;
      }

      const { from, to } = result.value;

      await this.kafkaProducer.publish({
        topic: Topics.EVT_WALLET_DEBITED,
        payload: {
          walletId: from.getId(),
          userId: from.getUserId(),
          amount: payload.amount,
          currency: payload.currency,
          newBalance: from.getBalance(),
        },
        aggregateId: from.getId(),
        aggregateType: 'Wallet',
        aggregateVersion: from.getVersion(),
        correlationId: envelope.correlationId,
        producer: 'wallet-service',
      });

      await this.kafkaProducer.publish({
        topic: Topics.EVT_WALLET_CREDITED,
        payload: {
          walletId: to.getId(),
          userId: to.getUserId(),
          amount: payload.amount,
          currency: payload.currency,
          newBalance: to.getBalance(),
        },
        aggregateId: to.getId(),
        aggregateType: 'Wallet',
        aggregateVersion: to.getVersion(),
        correlationId: envelope.correlationId,
        producer: 'wallet-service',
      });

      this.logger.log(
        `Transfer processed: from=${from.getId()} to=${to.getId()}`,
      );
    });
  }

  @EventPattern(Topics.CMD_WALLET_REFILL)
  async handleWalletRefill(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.CMD_WALLET_REFILL, async () => {
      this.logger.log(
        `Received cmd.wallet.refill userId=${payload.userId} amount=${payload.amount}`,
      );

      const result = await this.application.credit(
        payload.userId,
        payload.amount,
        payload.currency,
        payload.description,
      );

      if (result.isErr()) {
        this.logger.error(
          `Refill failed: ${result.error.message}`,
          result.error.stack,
        );

        await this.kafkaProducer.publish({
          topic: Topics.EVT_PAYMENT_FAILED,
          payload: {
            requestId: payload.requestId,
            reason: result.error.message,
          },
          aggregateId: payload.requestId,
          aggregateType: 'WalletRefill',
          aggregateVersion: 1,
          correlationId: envelope.correlationId,
          producer: 'wallet-service',
        });
        return;
      }

      const wallet = result.value;

      await this.kafkaProducer.publish({
        topic: Topics.EVT_WALLET_CREDITED,
        payload: {
          walletId: wallet.getId(),
          userId: wallet.getUserId(),
          amount: payload.amount,
          currency: payload.currency,
          newBalance: wallet.getBalance(),
        },
        aggregateId: wallet.getId(),
        aggregateType: 'Wallet',
        aggregateVersion: wallet.getVersion(),
        correlationId: envelope.correlationId,
        producer: 'wallet-service',
      });

      this.logger.log(
        `Refill processed: walletId=${wallet.getId()} newBalance=${wallet.getBalance()}`,
      );
    });
  }
}
