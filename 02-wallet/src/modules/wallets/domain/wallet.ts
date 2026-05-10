export interface WalletEssentials {
  userId: string;
}

export interface WalletOptionals {
  id: string;
  balance: number;
  currency: string;
}

export type WalletProps = WalletEssentials & Partial<WalletOptionals>;

export class Wallet {
  private readonly id?: string;
  private readonly userId: string;
  private balance: number;
  private currency: string;

  constructor(props: WalletProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.balance = props.balance ?? 0;
    this.currency = props.currency ?? 'PEN';
  }

  properties(): WalletProps {
    return {
      id: this.id,
      userId: this.userId,
      balance: this.balance,
      currency: this.currency,
    };
  }

  credit(amount: number) {
    if (amount <= 0) {
      throw new Error('Credit amount must be positive');
    }
    this.balance += amount;
  }

  debit(amount: number) {
    if (amount <= 0) {
      throw new Error('Debit amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient balance');
    }
    this.balance -= amount;
  }
}
