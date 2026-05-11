import { Kafka, Producer, Consumer } from 'kafkajs';
import { waitUntil } from './wait-until';

let producer: Producer | null = null;
let createdTopics: string[] = [];

export async function createKafkaProducer(broker: string): Promise<Producer> {
  const kafka = new Kafka({
    clientId: 'test-producer',
    brokers: [broker],
  });

  producer = kafka.producer();
  await producer.connect();
  return producer;
}

export async function ensureKafkaTopics(
  broker: string,
  topics: string[],
): Promise<void> {
  const kafka = new Kafka({
    clientId: `test-topic-init-${Date.now()}`,
    brokers: [broker],
  });
  const initProducer = kafka.producer();

  await initProducer.connect();
  try {
    for (const topic of topics) {
      if (createdTopics.includes(topic)) continue;

      await waitUntil(
        async () => {
          const metadata = await initProducer.send({
            topic,
            messages: [{ key: '__topic_init__', value: '{}' }],
          });
          return metadata.length > 0;
        },
        {
          timeout: 10000,
          interval: 500,
          message: `Kafka topic "${topic}" not ready`,
        },
      );
      createdTopics.push(topic);
    }
  } finally {
    await initProducer.disconnect();
  }
}

export async function publishEvent(
  topic: string,
  key: string,
  value: any,
): Promise<void> {
  if (!producer) throw new Error('Kafka producer not initialized');

  await producer.send({
    topic,
    messages: [{ key, value: JSON.stringify(value) }],
  });
}

export async function waitForKafkaMessage(
  broker: string,
  topic: string,
  predicate: (payload: any) => boolean,
  timeout = 30000,
): Promise<any> {
  const kafka = new Kafka({
    clientId: `test-wait-${Date.now()}`,
    brokers: [broker],
  });

  const consumer = kafka.consumer({
    groupId: `test-wait-group-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  await consumer.connect();

  return new Promise<any>(async (resolve, reject) => {
    const timer = setTimeout(async () => {
      try { await consumer.disconnect(); } catch {}
      reject(new Error(`Kafka wait timeout for topic "${topic}" (${timeout}ms)`));
    }, timeout);

    try {
      await consumer.subscribe({ topic, fromBeginning: true });

      await consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) return;
          try {
            const payload = JSON.parse(message.value.toString());
            if (predicate(payload)) {
              clearTimeout(timer);
              await consumer.stop();
              try { await consumer.disconnect(); } catch {}
              resolve(payload);
            }
          } catch {}
        },
      });
    } catch (err) {
      clearTimeout(timer);
      try { await consumer.disconnect(); } catch {}
      reject(err);
    }
  });
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  createdTopics = [];
}
