import { Controller, Get, Logger, Param, Query } from '@nestjs/common';
import { EventLogApplication } from '../../application/event-log.application';

@Controller('events')
export class ReplayController {
  private readonly logger = new Logger(ReplayController.name);

  constructor(private readonly application: EventLogApplication) {}

  @Get('replay')
  async replayByTopic(
    @Query('topic') topic: string,
    @Query('limit') limit?: string,
  ) {
    const all = await this.application.findAll(Number(limit) || 1000);
    const filtered = topic ? all.filter((e) => e.topic === topic) : all;

    this.logger.log(`Replay requested: topic=${topic} count=${filtered.length}`);

    return {
      topic,
      count: filtered.length,
      events: filtered,
    };
  }

  @Get('correlation/:correlationId')
  async byCorrelation(@Param('correlationId') correlationId: string) {
    const events = await this.application.findByCorrelationId(correlationId);
    return { correlationId, count: events.length, events };
  }

  @Get('aggregate/:aggregateId')
  async byAggregate(@Param('aggregateId') aggregateId: string) {
    const events = await this.application.findByAggregateId(aggregateId);
    return { aggregateId, count: events.length, events };
  }
}
