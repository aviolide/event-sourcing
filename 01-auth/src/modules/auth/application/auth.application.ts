import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { err, ok } from 'neverthrow';

import { UserApplication } from '../../users/application/user.application';
import { User } from '../../users/domain/user';
import { AuthTokens, YupiJwtPayload } from '../domain/auth.types';
import { RefreshToken } from '../infrastructure/entities/auth.entity';
import { InvalidCredentialsException } from '../../../core/exceptions/auth.exception';
import { KafkaProducer } from '../infrastructure/presentation/kafka.producer';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../domain/repositories/auth.repository';

@Injectable()
export class AuthApplication {
  private readonly accessTokenTtl: string;
  private readonly refreshTokenTtl: string;

  constructor(
    private readonly userApplication: UserApplication,
    private readonly jwtService: JwtService,
    @Inject(AuthRepository)
    private readonly authRepo: AuthRepository,
    private readonly kafkaProducer: KafkaProducer,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenTtl = this.configService.get('JWT_EXPIRES_IN')!;
    this.refreshTokenTtl = this.configService.get('JWT_REFRESH_EXPIRES_IN')!;
  }

  async register(
    fullName: string,
    email: string,
    phone: string,
    password: string,
  ) {
    const hashed = await bcrypt.hash(password, 12); // OWASP: strong hash
    const user = new User({ fullName, email, phone, passwordHash: hashed });

    const saveResult = await this.userApplication.save(user);

    if (saveResult.isErr()) {
      return saveResult;
    }

    const createdUser = saveResult.value;

    await this.kafkaProducer.emitUserCreated({
      id: createdUser.properties().id!,
      phone,
      email,
      fullName
    });

    const tokens = await this.generateTokens(createdUser);

    return ok({ user: createdUser, tokens });
  }

  async login(identifier: string, password: string) {
    const foundUser = await this.userApplication.findByEmail(identifier);

    if (foundUser.isErr() || !foundUser.value) {
      return err(new InvalidCredentialsException());
    }

    const user = foundUser.value;
    const { passwordHash } = user.properties();

    const match = await bcrypt.compare(password, passwordHash!);
    if (!match) {
      return err(new InvalidCredentialsException());
    }

    const tokens = await this.generateTokens(user);
    return ok({ user, tokens });
  }

  async refreshToken(userId: string, token: string) {
    const storedResult = await this.authRepo.findValidToken(token, userId);

    if (storedResult.isErr()) {
      return storedResult;
    }

    const stored = storedResult.value;
    if (!stored || stored.expiresAt < new Date() || stored.revoked) {
      return err(new InvalidCredentialsException('Invalid refresh token'));
    }

    const userResult = await this.userApplication.findById(userId);
    if (userResult.isErr() || !userResult.value) {
      return err(new InvalidCredentialsException('Invalid user'));
    }

    const user = userResult.value;
    const tokens = await this.generateTokens(user);

    await this.authRepo.revokeToken(stored.id);

    return ok({ user, tokens });
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
  const props = user.properties();
  const payload: YupiJwtPayload = {
    sub: props.id!,
    email: props.email
  };

  // Access token: use config of JwtModule (secret + expiresIn are there)
  const accessToken = await this.jwtService.signAsync(payload);

  // Refresh token: secret and ttl different
  const refreshToken = await this.jwtService.signAsync(payload, {
    secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
    expiresIn: this.refreshTokenTtl as string,
    algorithm: 'HS256',
  } as any
);

  const refreshEntity = new RefreshToken();
  refreshEntity.token = refreshToken;
  refreshEntity.user = { id: props.id! } as any;
  refreshEntity.expiresAt = this.addTtlToDate(this.refreshTokenTtl);

  await this.authRepo.saveToken(refreshEntity);

  return { accessToken, refreshToken };
}

  private addTtlToDate(ttl: string): Date {
    const date = new Date();
    const match = ttl.match(/(\d+)([smhd])/);
    if (!match) return date;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (unit === 'd') date.setDate(date.getDate() + value);
    if (unit === 'h') date.setHours(date.getHours() + value);
    if (unit === 'm') date.setMinutes(date.getMinutes() + value);
    if (unit === 's') date.setSeconds(date.getSeconds() + value);

    return date;
  }
}