import { IsOptional, IsEnum, IsString } from 'class-validator';
import { OrderStatus, PaymentStatus } from '../entities/order.entity';

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  note?: string;
}