import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // ✅ Import HttpModule
import { VNPayModule } from '../vnpay/vnpay.module'; // Thêm VNPay module
import { PaymentController } from './payment.controller';
import { MomoService } from '../momo/momo.service';
import { OrderModule } from '../order/order.module';

@Module({
    imports: [OrderModule,HttpModule, VNPayModule],
    controllers: [PaymentController],
    providers: [MomoService],
    exports: [MomoService],
})
export class PaymentModule { }