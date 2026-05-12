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

  @EventPattern(Topics.CMD_WALLET_RESERVE)
  async handleWalletReserve(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.CMD_WALLET_RESERVE, async () => {
      this.logger.log(
        `Received cmd.wallet.reserve userId=${payload.userId} amount=${payload.amount} transferId=${payload.transferId}`,
      );

      const result = await this.application.reserve(
        payload.userId,
        payload.amount,
        payload.currency,
        payload.transferId,
      );

      if (result.isErr()) {
        this.logger.error(
          `Reserve failed: ${result.error.message}`,
          result.error.stack,
        );

        await this.kafkaProducer.publish({
          topic: Topics.EVT_WALLET_RESERVE_FAILED,
          payload: {
            transferId: payload.transferId,
            userId: payload.userId,
            amount: payload.amount,
            currency: payload.currency,
            reason: result.error.message,
          },
          aggregateId: payload.transferId,
          aggregateType: 'Wallet',
          aggregateVersion: 1,
          correlationId: envelope.correlationId,
          producer: 'wallet-service',
        });
        return;
      }

      await this.kafkaProducer.publish({
        topic: Topics.EVT_WALLET_RESERVED,
        payload: {
          transferId: payload.transferId,
          userId: payload.userId,
          amount: payload.amount,
          currency: payload.currency,
        },
        aggregateId: payload.transferId,
        aggregateType: 'Wallet',
        aggregateVersion: 1,
        correlationId: envelope.correlationId,
        producer: 'wallet-service',
      });

      this.logger.log(`Reserve succeeded: transferId=${payload.transferId}`);
    });
  }

  @EventPattern(Topics.CMD_WALLET_CREDIT)
  async handleWalletCredit(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.CMD_WALLET_CREDIT, async () => {
      this.logger.log(
        `Received cmd.wallet.credit userId=${payload.userId} amount=${payload.amount} transferId=${payload.transferId}`,
      );

      const result = await this.application.credit(
        payload.userId,
        payload.amount,
        payload.currency,
        payload.transferId,
      );

      if (result.isErr()) {
        this.logger.error(
          `Credit failed: ${result.error.message}`,
          result.error.stack,
        );

        await this.kafkaProducer.publish({
          topic: Topics.EVT_WALLET_CREDIT_FAILED,
          payload: {
            transferId: payload.transferId,
            userId: payload.userId,
            amount: payload.amount,
            currency: payload.currency,
            reason: result.error.message,
          },
          aggregateId: payload.transferId,
          aggregateType: 'Wallet',
          aggregateVersion: 1,
          correlationId: envelope.correlationId,
          producer: 'wallet-service',
        });
        return;
      }

      await this.kafkaProducer.publish({
        topic: Topics.EVT_WALLET_CREDITED,
        payload: {
          transferId: payload.transferId,
          userId: payload.userId,
          amount: payload.amount,
          currency: payload.currency,
        },
        aggregateId: payload.transferId,
        aggregateType: 'Wallet',
        aggregateVersion: 1,
        correlationId: envelope.correlationId,
        producer: 'wallet-service',
      });

      this.logger.log(`Credit succeeded: transferId=${payload.transferId}`);
    });
  }

  @EventPattern(Topics.CMD_WALLET_RELEASE)
  async handleWalletRelease(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.CMD_WALLET_RELEASE, async () => {
      this.logger.log(
        `Received cmd.wallet.release userId=${payload.userId} amount=${payload.amount} transferId=${payload.transferId}`,
      );

      const result = await this.application.release(
        payload.userId,
        payload.amount,
        payload.currency,
        payload.transferId,
      );

      if (result.isErr()) {
        this.logger.error(
          `Release failed: ${result.error.message}`,
          result.error.stack,
        );
        return;
      }

      await this.kafkaProducer.publish({
        topic: Topics.EVT_WALLET_RELEASED,
        payload: {
          transferId: payload.transferId,
          userId: payload.userId,
          amount: payload.amount,
          currency: payload.currency,
        },
        aggregateId: payload.transferId,
        aggregateType: 'Wallet',
        aggregateVersion: 1,
        correlationId: envelope.correlationId,
        producer: 'wallet-service',
      });

      this.logger.log(`Release succeeded: transferId=${payload.transferId}`);
    });
  }

  @EventPattern(Topics.CMD_WALLET_COMMIT)
  async handleWalletCommit(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const envelope = message.payload ? message : { payload: message };
    const payload = envelope.payload;
    const messageId = envelope.messageId || context.getMessage().offset;

    await this.inboxGuard.process(messageId, Topics.CMD_WALLET_COMMIT, async () => {
      this.logger.log(
        `Received cmd.wallet.commit userId=${payload.userId} amount=${payload.amount} transferId=${payload.transferId}`,
      );

      const result = await this.application.commit(
        payload.userId,
        payload.amount,
        payload.currency,
        payload.transferId,
      );

      if (result.isErr()) {
        this.logger.error(
          `Commit failed: ${result.error.message}`,
          result.error.stack,
        );

        await this.kafkaProducer.publish({
          topic: Topics.EVT_WALLET_COMMIT_FAILED,
          payload: {
            transferId: payload.transferId,
            userId: payload.userId,
            amount: payload.amount,
            currency: payload.currency,
            reason: result.error.message,
          },
          aggregateId: payload.transferId,
          aggregateType: 'Wallet',
          aggregateVersion: 1,
          correlationId: envelope.correlationId,
          producer: 'wallet-service',
        });
        return;
      }

      await this.kafkaProducer.publish({
        topic: Topics.EVT_WALLET_COMMITTED,
        payload: {
          transferId: payload.transferId,
          userId: payload.userId,
          amount: payload.amount,
          currency: payload.currency,
        },
        aggregateId: payload.transferId,
        aggregateType: 'Wallet',
        aggregateVersion: 1,
        correlationId: envelope.correlationId,
        producer: 'wallet-service',
      });

      this.logger.log(`Commit succeeded: transferId=${payload.transferId}`);
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
        payload.requestId,
      );

      if (result.isErr()) {
        this.logger.error(
          `Refill failed: ${result.error.message}`,
          result.error.stack,
        );
        return;
      }

      await this.kafkaProducer.publish({
        topic: Topics.EVT_WALLET_CREDITED,
        payload: {
          walletId: payload.userId,
          userId: payload.userId,
          amount: payload.amount,
          currency: payload.currency,
          transferId: payload.requestId,
        },
        aggregateId: payload.requestId,
        aggregateType: 'Wallet',
        aggregateVersion: 1,
        correlationId: envelope.correlationId,
        producer: 'wallet-service',
      });

      this.logger.log(`Refill processed: userId=${payload.userId}`);
    });
  }
}
