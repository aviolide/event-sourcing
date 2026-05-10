import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';

let container: StartedKafkaContainer | null = null;

export async function startKafkaContainer(): Promise<StartedKafkaContainer> {
  if (container) return container;

  container = await new KafkaContainer('confluentinc/cp-kafka:7.6.1').start();

  return container;
}

export async function stopKafkaContainer(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
}

export function getKafkaBroker(): string {
  if (!container) throw new Error('Kafka container not started');
  return `${container.getHost()}:${container.getMappedPort(9092)}`;
}
