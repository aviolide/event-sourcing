import { IsUUID, IsNumber, IsPositive, IsString } from 'class-validator';

export class TransferWalletDto {
  @IsUUID()
  fromUserId: string;

  @IsUUID()
  toUserId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  currency: string;
}