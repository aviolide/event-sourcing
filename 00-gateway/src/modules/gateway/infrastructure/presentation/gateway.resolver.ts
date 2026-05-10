import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';

import { DownstreamHttpClient } from '../http/downstream-http.client';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { LoginInput, LoginResponse } from './dtos/login.dto';
import { RefreshInput, RefreshResponse } from './dtos/refresh.dto';
import { WalletDto } from './dtos/wallet.dto';
import { TransferInput, TransferResponse } from './dtos/transfer.dto';
import { RegisterInput, RegisterResponse } from './dtos/register.dto';

@Resolver()
export class GatewayResolver {
  constructor(private readonly http: DownstreamHttpClient) {}

  @Mutation(() => RegisterResponse)
  async register(@Args('input') input: RegisterInput) {
    const res = await this.http.register(input);

    return {
      accessToken: res.tokens.accessToken,
      refreshToken: res.tokens.refreshToken,
    };
  }

  @Mutation(() => LoginResponse)
  async login(@Args('input') input: LoginInput) {
    const res = await this.http.login(input);
    return {
    accessToken: res.tokens.accessToken,
    refreshToken: res.tokens.refreshToken,
  };
  }

  @Mutation(() => RefreshResponse)
  async refresh(@Args('input') input: RefreshInput) {
    return this.http.refresh(input);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => WalletDto)
  async wallet(@Args('userId') userId: string) {
    return this.http.getWallet(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => TransferResponse)
  async transfer(
    @Args('input') input: TransferInput,
    @Context() ctx: any,
  ) {
    const bearer =
      ctx?.req?.headers?.authorization ??
      ctx?.req?.headers?.Authorization;

    if (!bearer) throw new UnauthorizedException('Missing Authorization header');

      const res = await this.http.transfer(input, bearer);

      return {
        id: res.id,
        status: res.status,
        description: res.description
      };

  }
}
