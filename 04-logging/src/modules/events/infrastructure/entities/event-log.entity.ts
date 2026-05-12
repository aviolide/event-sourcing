import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'event_logs' })
export class EventLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  topic: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  messageId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  correlationId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  causationId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  aggregateId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  aggregateType: string | null;

  @Column({ type: 'integer', nullable: true })
  aggregateVersion: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  producer: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn()
  receivedAt: Date;
}
