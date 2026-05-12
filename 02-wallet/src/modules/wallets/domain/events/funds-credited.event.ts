export interface FundsCreditedEvent {
  walletId: string;
  amount: number;
  transferId: string;
  reason?: string;
}
