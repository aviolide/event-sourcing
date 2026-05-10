import { Field, ObjectType } from '@nestjs/graphql';
import { IsUUID, IsNumber, IsString } from 'class-validator';

@ObjectType()
export class WalletDto {
  @Field()
  @IsUUID()
  id: string;

  @Field()
  @IsUUID()
  userId: string;

  @Field()
  @IsNumber()
  balance: number;

  @Field()
  @IsString()
  currency: string;
}
