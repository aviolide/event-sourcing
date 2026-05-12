import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'payment_status_view' })
@Index(['paymentId'], { unique: true })
export class PaymentStatusView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  paymentId: string;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'uuid' })
  fromUserId: string;

  @Column({ type: 'uuid' })
  toUserId: string;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
