import {
  Body,
  Controller,
  Inject,
  InternalServerErrorException,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { PaymentsApplication } from '../../application/payments.application';

import { CreatePaymentDto } from './dtos/create-payment.dto';
import {
  PaymentDomainValidationException,
} from '../../../../core/exceptions/payment.exception';
import { RefillPaymentDto } from './dtos/refill-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(PaymentsApplication)
    private readonly application: PaymentsApplication,
  ) {}

  
  @UseGuards(JwtAuthGuard)
  @Post('refill')
  async createRefill(@Body() body: RefillPaymentDto, @Req() req: any) {
    console.log('got refill request')
    const userId = req.user.sub;
    const result = await this.application.refill({
      userId,
      amount: body.amount,
      currency: body.currency,
      description: body.description,
    });

    if (result.isErr()) {
      const error = result.error;

      if (error instanceof PaymentDomainValidationException) {
        throw new InternalServerErrorException(error.message);
      }

        throw new InternalServerErrorException('Error in refill payment', {
          description: error.stack,
        });

    }

    const payment = result.value.payment.properties();

    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      fromUserId: payment.fromUserId,
      toUserId: payment.toUserId,
      description: payment.description,
      createdAt: payment.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('transfer')
  async createTransfer(@Body() body: CreatePaymentDto, @Req() req: any) {
    const fromUserId = req.user.sub;
    console.log('post transfer userId', fromUserId)
    const result = await this.application.createPayment({
      fromUserId,
      toUserId: body.toUserId,
      amount: body.amount,
      currency: body.currency,
      description: body.description,
    });

    if (result.isErr()) {
      const error = result.error;

      if (error instanceof PaymentDomainValidationException) {
        throw new InternalServerErrorException(error.message);
      }

        throw new InternalServerErrorException('Error creating payment', {
          description: error.stack,
        });

    }

    const payment = result.value.properties();

    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      fromUserId: payment.fromUserId,
      toUserId: payment.toUserId,
      description: payment.description,
      createdAt: payment.createdAt,
    };
  }
}
