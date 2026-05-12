import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SagaStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING';
export type SagaType = 'Transfer';

@Entity({ name: 'saga_instances' })
@Index(['correlationId'], { unique: true })
export class SagaInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sagaId: string;

  @Column({ type: 'varchar', length: 50 })
  type: SagaType;

  @Column({ type: 'varchar', length: 50 })
  status: SagaStatus;

  @Column({ type: 'varchar', length: 50 })
  step: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
