import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  fullName: string;

  @Field()
  @IsEmail()
  @Length(5, 120)
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  @Matches(/^[0-9+() -]+$/)
  phone?: string;

  @Field()
  @IsString()
  @Length(8, 72)
  // OWASP-ish: al menos 1 mayus, 1 minus, 1 número
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
  password: string;
}

@ObjectType()
export class RegisterResponse {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;
}
