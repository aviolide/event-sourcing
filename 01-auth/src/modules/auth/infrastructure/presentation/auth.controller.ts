import {
  Body,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthApplication } from '../../application/auth.application';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { InvalidCredentialsException } from '../../../../core/exceptions/auth.exception';
import { LoggingInterceptor } from '../../../../core/interceptors/logging.interceptor';
import { JwtAuthGuard } from './jwt-auth.guard';
import { BaseException } from 'src/core/exceptions/base.exception';

@Controller('auth')
@UseInterceptors(LoggingInterceptor)
export class AuthController {
  constructor(
    @Inject(AuthApplication)
    private readonly application: AuthApplication,
  ) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const result = await this.application.register(
      body.fullName,
      body.email,
      body.phone,
      body.password,
    );

    if (result.isErr()) {
      const error = result.error;
      throw new InternalServerErrorException(error.message, {
        description: error.stack,
      });
    }

    const { user, tokens } = result.value;
    const props = user.properties();
    // Dont return password (OWASP)
    return {
      user: {
        id: props.id,
        fullName: props.fullName,
        email: props.email,
        phone: props.phone,
      },
      tokens,
    };
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const result = await this.application.login(
      body.identifier,
      body.password,
    );

    if (result.isErr()) {
      const error = result.error as BaseException;
      if (error instanceof InvalidCredentialsException) {
        // generic error, dont tell the specific error (OWASP)
        throw new InvalidCredentialsException();
      }

      throw new InternalServerErrorException(error.message, {
        description: error.stack,
      });
    }

    const { user, tokens } = result.value;
    const props = user.properties();

    return {
      user: {
        id: props.id,
        fullName: props.fullName,
        email: props.email,
        phone: props.phone,
      },
      tokens,
    };
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(@Req() req: Request, @Body() body: RefreshTokenDto) {
    const user = (req as any).user as { userId: string };

    const result = await this.application.refreshToken(
      user.userId,
      body.refreshToken,
    );

    if (result.isErr()) {
      const error = result.error;
      throw new InvalidCredentialsException(error.message);
    }

    const { user: u, tokens } = result.value;
    const props = u.properties();

    return {
      user: {
        id: props.id,
        fullName: props.fullName,
        email: props.email,
        phone: props.phone,
      },
      tokens,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const user = (req as any).user as {
      userId: string;
      email: string;
    };
    return user;
  }
}