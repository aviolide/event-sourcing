import { Controller, Get, Query, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';

import { EventLogApplication } from '../../application/event-log.application';
import { EventLog } from '../../domain/event-log';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('events')
export class SseController {
  constructor(private readonly application: EventLogApplication) {}

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.application.subscribe().pipe(
      map((event: EventLog) => ({
        data: JSON.stringify(event),
        id: event.id,
        type: 'event',
      })),
    );
  }

  @Get()
  async list(@Query('limit') limit?: string) {
    const take = limit ? Math.min(Number(limit), 200) : 50;
    return this.application.findAll(take);
  }
}
