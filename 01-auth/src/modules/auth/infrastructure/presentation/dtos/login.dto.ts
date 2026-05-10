import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // email 

  @IsString()
  @IsNotEmpty()
  password: string;
}