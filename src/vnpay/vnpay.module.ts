import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VNPayService } from './vnpay.service';

@Module({
    imports: [HttpModule],
    providers: [VNPayService],
    exports: [VNPayService],
})
export class VNPayModule { }