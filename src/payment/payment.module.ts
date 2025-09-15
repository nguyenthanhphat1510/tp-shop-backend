import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { MomoService } from '../momo/momo.service';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [OrderModule],
  controllers: [PaymentController],
  providers: [MomoService],
  exports: [MomoService],
})
export class PaymentModule {}