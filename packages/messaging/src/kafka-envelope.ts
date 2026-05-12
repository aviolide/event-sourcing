export interface KafkaEnvelope<T = unknown> {
  eventId: string;
  messageId: string;
  correlationId: string;
  causationId?: string;

  aggregateId: string;
  aggregateType: string;
  aggregateVersion: number;

  topicVersion: number;
  occurredAt: string;
  producer: string;

  payload: T;
}

export function createEnvelope<T>(
  params: Omit<KafkaEnvelope<T>, 'topicVersion'> & { topicVersion?: number },
): KafkaEnvelope<T> {
  return {
    topicVersion: 1,
    ...params,
  };
}
