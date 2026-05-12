import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'wallet_snapshots' })
@Index(['walletId'], { unique: true })
export class WalletSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 3, default: 'PEN' })
  currency: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  balance: string;

  @Column({ type: 'integer' })
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
