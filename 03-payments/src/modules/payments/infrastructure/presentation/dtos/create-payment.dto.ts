import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  toUserId: string;

  @IsNumber()
  @Min(0.1)
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  description?: string;
}
