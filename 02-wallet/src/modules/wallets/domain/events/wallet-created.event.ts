export interface WalletCreatedEvent {
  walletId: string;
  userId: string;
  currency: string;
  initialBalance: number;
}
