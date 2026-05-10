export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface PaymentEssentials {
  fromUserId: string;
  toUserId: string;         
  amount: number;
  currency: string;         
}

export interface PaymentOptionals {
  id: string;
  description?: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentProps = PaymentEssentials & Partial<PaymentOptionals>;

export class Payment {
  private readonly id: string;
  private readonly fromUserId!: string;
  private readonly toUserId!: string;
  private amount!: number;
  private currency!: string;
  private description?: string;
  private status!: PaymentStatus;
  private createdAt!: Date;
  private updatedAt!: Date;

  constructor(props: PaymentProps) {
    Object.assign(this, {
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...props,
    });
  }

  properties(): PaymentProps {
    return {
      id: this.id,
      fromUserId: this.fromUserId,
      toUserId: this.toUserId,
      amount: this.amount,
      currency: this.currency,
      description: this.description,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  markCompleted() {
    this.status = 'COMPLETED';
    this.updatedAt = new Date();
  }

  markFailed() {
    this.status = 'FAILED';
    this.updatedAt = new Date();
  }
}