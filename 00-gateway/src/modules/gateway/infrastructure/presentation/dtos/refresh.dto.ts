import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class RefreshInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @IsJWT()
  refreshToken: string;
}

@ObjectType()
export class RefreshResponse {
  @Field()
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
