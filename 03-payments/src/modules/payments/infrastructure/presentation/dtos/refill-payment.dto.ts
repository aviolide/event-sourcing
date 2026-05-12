import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RefillPaymentDto {
  @IsNumber()
  @Min(0.1)
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  description?: string;
}