import { Wallet } from '../../../domain/wallet';

export class WalletResponseDto {
  id: string;
  userId: string;
  balance: number;
  currency: string;

  static fromDomain(wallet: Wallet): WalletResponseDto {
    const props = wallet.properties();
    const dto = new WalletResponseDto();
    dto.id = props.id!;
    dto.userId = props.userId;
    dto.balance = props.balance ?? 0;
    dto.currency = props.currency ?? 'PEN';
    return dto;
  }
}
