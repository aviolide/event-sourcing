import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AuthHttpClient } from '../http/auth-http.client';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { LoginInput, LoginResponse } from './dtos/login.dto';
import { RefreshInput, RefreshResponse } from './dtos/refresh.dto';
import { WalletDto } from './dtos/wallet.dto';
import { TransferInput, TransferResponse } from './dtos/transfer.dto';
import { RegisterInput, RegisterResponse } from './dtos/register.dto';
import { RefillWalletResponse, RefillWalletInput } from './dtos/refill.dto';
import { KafkaProducerService, Topics } from '@yupi/messaging';
import { ProjectionRepository } from '../projections/projection.repository';

@Resolver()
export class GatewayResolver {
  constructor(
    private readonly authHttp: AuthHttpClient,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly projectionRepo: ProjectionRepository,
  ) {}

  @Mutation(() => RegisterResponse)
  async register(@Args('input') input: RegisterInput) {
    const res = await this.authHttp.register(input);
    return {
      accessToken: res.tokens.accessToken,
      refreshToken: res.tokens.refreshToken,
    };
  }

  @Mutation(() => LoginResponse)
  async login(@Args('input') input: LoginInput) {
    const res = await this.authHttp.login(input);
    return {
      accessToken: res.tokens.accessToken,
      refreshToken: res.tokens.refreshToken,
    };
  }

  @Mutation(() => RefreshResponse)
  async refresh(@Args('input') input: RefreshInput) {
    return this.authHttp.refresh(input);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => WalletDto)
  async wallet(@Args('userId') userId: string) {
    const projection = await this.projectionRepo.findWalletByUserId(userId);
    if (!projection) {
      throw new UnauthorizedException('Wallet not found in projections');
    }
    return {
      ...projection,
      available: projection.balance - projection.reserved,
    };
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

    const requestId = randomUUID();
    const user = ctx.req.user;

    await this.kafkaProducer.publish({
      topic: Topics.CMD_PAYMENT_TRANSFER_CREATE,
      payload: {
        requestId,
        fromUserId: user.sub,
        toUserId: input.toUserId,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      },
      aggregateId: requestId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 1,
      correlationId: requestId,
      producer: 'gateway',
    });

    return {
      requestId,
      id: requestId,
      status: 'ACCEPTED',
      description: 'Transfer command accepted for processing',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => RefillWalletResponse)
  async refillWallet(
    @Args('input') input: RefillWalletInput,
    @Context() ctx: any,
  ) {
    const bearer =
      ctx?.req?.headers?.authorization ??
      ctx?.req?.headers?.Authorization;

    if (!bearer) throw new UnauthorizedException('Missing Authorization header');

    const requestId = randomUUID();
    const user = ctx.req.user;

    await this.kafkaProducer.publish({
      topic: Topics.CMD_WALLET_REFILL,
      payload: {
        requestId,
        userId: user.sub,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      },
      aggregateId: requestId,
      aggregateType: 'WalletRefill',
      aggregateVersion: 1,
      correlationId: requestId,
      producer: 'gateway',
    });

    return {
      requestId,
      id: requestId,
      status: 'ACCEPTED',
      description: 'Refill command accepted for processing',
    };
  }
}
