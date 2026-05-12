export interface WalletEvent {
  type: string;
  payload: Record<string, unknown>;
  version: number;
}

export class Wallet {
  private id: string;
  private userId: string;
  private balance: number;
  private reserved: number;
  private currency: string;
  private version: number;

  constructor(id: string, userId: string, currency = 'PEN') {
    this.id = id;
    this.userId = userId;
    this.balance = 0;
    this.reserved = 0;
    this.currency = currency;
    this.version = 0;
  }

  static create(id: string, userId: string, currency = 'PEN'): Wallet {
    return new Wallet(id, userId, currency);
  }

  applyEvents(events: Array<{ eventType: string; payload: Record<string, unknown> }>) {
    for (const event of events) {
      this.apply(event.eventType, event.payload);
      this.version++;
    }
  }

  private apply(eventType: string, payload: Record<string, unknown>) {
    switch (eventType) {
      case 'WalletCreated':
        this.balance = (payload.initialBalance as number) ?? 0;
        break;
      case 'FundsCredited':
        this.balance += payload.amount as number;
        break;
      case 'FundsReserved':
        this.reserved += payload.amount as number;
        break;
      case 'FundsReleased':
        this.reserved -= payload.amount as number;
        break;
      case 'TransferCommitted':
        this.balance -= payload.amount as number;
        this.reserved -= payload.amount as number;
        break;
      default:
        break;
    }
  }

  canReserve(amount: number): boolean {
    return this.balance - this.reserved >= amount && amount > 0;
  }

  getBalance(): number {
    return this.balance;
  }

  getReserved(): number {
    return this.reserved;
  }

  getAvailable(): number {
    return this.balance - this.reserved;
  }

  getVersion(): number {
    return this.version;
  }

  getId(): string {
    return this.id;
  }

  getUserId(): string {
    return this.userId;
  }

  getCurrency(): string {
    return this.currency;
  }
}
