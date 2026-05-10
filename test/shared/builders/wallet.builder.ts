export class WalletBuilder {
  private props: Record<string, any> = {
    currency: 'PEN',
    balance: '0',
  };

  static aWallet(): WalletBuilder {
    return new WalletBuilder();
  }

  withUserId(userId: string): WalletBuilder {
    this.props.userId = userId;
    return this;
  }

  withBalance(balance: string): WalletBuilder {
    this.props.balance = balance;
    return this;
  }

  withCurrency(currency: string): WalletBuilder {
    this.props.currency = currency;
    return this;
  }

  build() {
    return { ...this.props };
  }
}
