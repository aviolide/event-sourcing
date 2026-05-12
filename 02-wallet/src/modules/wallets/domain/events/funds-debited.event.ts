export interface FundsDebitedEvent {
  walletId: string;
  amount: number;
  transferId: string;
  reason?: string;
}
