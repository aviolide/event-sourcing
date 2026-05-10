import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';

import { WalletApplication } from '../../application/wallet.application';
import {
  WalletInsufficientFundsException,
  WalletNotFoundException,
  WalletTransferDatabaseException,
} from '../../../../core/exceptions/wallet.exception';
import { WalletResponseDto } from './dtos/wallet-response.dto';
import { TransferWalletDto } from './dtos/transfer-wallet.dto';

@Controller('wallets')
export class WalletController {
  constructor(
    @Inject(WalletApplication)
    private readonly application: WalletApplication,
  ) {}

  @Post('transfer')
  async transfer(@Body() body: TransferWalletDto) {
    const result = await this.application.transfer(
      body.fromUserId,
      body.toUserId,
      body.amount,
      body.currency,
    );

    if (result.isErr()) {
      const error = result.error;

      if (error instanceof WalletNotFoundException) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof WalletInsufficientFundsException) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof WalletTransferDatabaseException) {
        throw new InternalServerErrorException('Error processing transfer', {
          description: error.stack,
        });
      }

      // Fallback genérico
      throw new InternalServerErrorException(error.message, {
        description: error.stack,
      });
    }

    const { from, to } = result.value;

    return {
      from: from.properties(),
      to: to.properties(),
    };
  }

  @Get(':userId')
  async getByUserId(@Param('userId') userId: string) {
    const result = await this.application.getByUserId(userId);

    if (result.isErr()) {
      const error = result.error;

      if (error instanceof WalletNotFoundException) {
        throw new NotFoundException(error.message);
      }

      throw new InternalServerErrorException(error.message, {
          description: error.stack,
        });
    }

    return WalletResponseDto.fromDomain(result.value);
  }
}
