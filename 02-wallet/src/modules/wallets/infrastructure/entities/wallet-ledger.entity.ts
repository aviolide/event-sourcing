import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type WalletEventType =
  | 'WalletCreated'
  | 'FundsCredited'
  | 'FundsDebited'
  | 'TransferReserved'
  | 'TransferCommitted'
  | 'TransferRejected';

@Entity({ name: 'wallet_ledger_entries' })
@Index(['walletId', 'version'], { unique: true })
export class WalletLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'varchar', length: 50 })
  eventType: WalletEventType;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'integer' })
  version: number;

  @CreateDateColumn()
  occurredAt: Date;
}
