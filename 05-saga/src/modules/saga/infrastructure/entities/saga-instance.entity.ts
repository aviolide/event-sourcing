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
export type SagaStep =
  | 'INITIATED'
  | 'RESERVING'
  | 'RESERVED'
  | 'RESERVE_FAILED'
  | 'CREDITING'
  | 'CREDITED'
  | 'CREDIT_FAILED'
  | 'COMMITTING'
  | 'RELEASING'
  | 'COMPLETED'
  | 'FAILED';

@Entity({ name: 'saga_instances' })
@Index(['requestId'], { unique: true })
export class SagaInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  requestId: string;

  @Column({ type: 'varchar', length: 50 })
  type: SagaType;

  @Column({ type: 'varchar', length: 50 })
  status: SagaStatus;

  @Column({ type: 'varchar', length: 50 })
  step: SagaStep;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
