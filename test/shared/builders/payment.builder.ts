export class PaymentBuilder {
  private props: Record<string, any> = {
    amount: 100,
    currency: 'PEN',
    description: 'Test payment',
  };

  static aPayment(): PaymentBuilder {
    return new PaymentBuilder();
  }

  fromUser(userId: string): PaymentBuilder {
    this.props.fromUserId = userId;
    return this;
  }

  toUser(userId: string): PaymentBuilder {
    this.props.toUserId = userId;
    return this;
  }

  withAmount(amount: number): PaymentBuilder {
    this.props.amount = amount;
    return this;
  }

  withCurrency(currency: string): PaymentBuilder {
    this.props.currency = currency;
    return this;
  }

  build() {
    return { ...this.props };
  }
}
