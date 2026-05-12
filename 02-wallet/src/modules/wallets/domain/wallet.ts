export interface WalletEvent {
  type: string;
  payload: Record<string, unknown>;
  version: number;
}

export class Wallet {
  private id: string;
  private userId: string;
  private balance: number;
  private currency: string;
  private version: number;

  constructor(id: string, userId: string, currency = 'PEN') {
    this.id = id;
    this.userId = userId;
    this.balance = 0;
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
      case 'FundsDebited':
        this.balance -= payload.amount as number;
        break;
      default:
        break;
    }
  }

  canDebit(amount: number): boolean {
    return this.balance >= amount && amount > 0;
  }

  getBalance(): number {
    return this.balance;
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
