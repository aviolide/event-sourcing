import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  IsUUID,
  IsPositive,
  IsNumber,
  IsString,
  IsOptional,
  Length,
} from 'class-validator';

@InputType()
export class RefillWalletInput {
  @Field()
  @IsNumber()
  @IsPositive()
  amount: number;

  @Field()
  @IsString()
  @Length(3, 3)
  currency: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  description?: string;
}

@ObjectType()
export class RefillWalletResponse {
  @Field()
  @IsString()
  requestId: string;

  @Field()
  @IsString()
  status: string;

  @Field()
  @IsUUID()
  id: string;

  @Field()
  @IsString()
  description: string;
}
