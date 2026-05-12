import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { InboxMessage } from './inbox.entity';

@Injectable()
export class InboxGuard {
  private readonly logger = new Logger(InboxGuard.name);
  private readonly repository: Repository<InboxMessage>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(InboxMessage);
  }

  async isDuplicate(messageId: string): Promise<boolean> {
    const existing = await this.repository.findOne({ where: { messageId } });
    return !!existing;
  }

  async markProcessed(messageId: string, topic: string): Promise<void> {
    try {
      await this.repository.save(
        this.repository.create({ messageId, topic }),
      );
    } catch (err) {
      if ((err as Error).message?.includes('duplicate')) {
        this.logger.warn(`Duplicate inbox entry for messageId=${messageId}`);
        return;
      }
      throw err;
    }
  }

  async process<T>(
    messageId: string,
    topic: string,
    handler: () => Promise<T>,
  ): Promise<T | null> {
    if (await this.isDuplicate(messageId)) {
      this.logger.warn(
        `Skipping duplicate message: messageId=${messageId} topic=${topic}`,
      );
      return null;
    }

    const result = await handler();
    await this.markProcessed(messageId, topic);
    return result;
  }
}
