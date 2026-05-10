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

// `@testcontainers/kafka` exposes the PLAINTEXT client listener on container
// port 9093 (KAFKA_PORT). Port 9092 (KAFKA_BROKER_PORT) is the inter-broker
// listener and is *not* published to the host, so `getMappedPort(9092)` throws
// "No port binding found for :9092/tcp". Always use 9093 for client traffic.
const KAFKA_CLIENT_PORT = 9093;

export function getKafkaBroker(): string {
  if (!container) throw new Error('Kafka container not started');
  return `${container.getHost()}:${container.getMappedPort(KAFKA_CLIENT_PORT)}`;
}
