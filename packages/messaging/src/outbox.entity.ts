import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'outbox_events' })
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  topic: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  aggregateId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  aggregateType: string;

  @Column({ type: 'jsonb' })
  envelope: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  sent: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;
}
