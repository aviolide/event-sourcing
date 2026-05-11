import { loadStageEnv } from '../../shared/test-env';

describe('Stage Environment', () => {
  it('should load stage infrastructure env configuration', () => {
    const env = loadStageEnv();
    expect(env).toHaveProperty('db');
    expect(env.db).toHaveProperty('host');
    expect(env.db).toHaveProperty('port');
    expect(env.db).toHaveProperty('database');
    expect(env.db).toHaveProperty('username');
    expect(env.db.url).toContain('postgresql://');
  });

  it('should have a valid database port', () => {
    const env = loadStageEnv();
    expect(env.db.port).toBeGreaterThan(0);
    expect(env.db.port).toBeLessThan(65536);
  });

  it('should have Kafka broker configured', () => {
    const env = loadStageEnv();
    expect(env.kafka.broker).toBeTruthy();
    expect(env.kafka.broker).toContain(':');
  });
});
