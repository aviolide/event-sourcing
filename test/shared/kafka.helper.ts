import { Kafka, Producer, Consumer } from 'kafkajs';

let producer: Producer | null = null;

export async function createKafkaProducer(broker: string): Promise<Producer> {
  const kafka = new Kafka({
    clientId: 'test-producer',
    brokers: [broker],
  });

  producer = kafka.producer();
  await producer.connect();
  return producer;
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
}
