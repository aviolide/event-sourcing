import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WalletBalanceView } from '../entities/wallet-balance.view';
import { PaymentStatusView } from '../entities/payment-status.view';
import { ProjectionsService } from './projections.service';
import { ProjectionsConsumer } from './projections.consumer';
import { InboxGuard } from '@yupi/messaging';

@Module({
  imports: [TypeOrmModule.forFeature([WalletBalanceView, PaymentStatusView])],
  controllers: [ProjectionsConsumer],
  providers: [ProjectionsService, InboxGuard],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
