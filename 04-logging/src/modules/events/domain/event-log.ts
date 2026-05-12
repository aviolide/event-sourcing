export interface EventLog {
  id: string;
  topic: string;
  key: string | null;
  payload: Record<string, unknown>;
  receivedAt: Date;
}
