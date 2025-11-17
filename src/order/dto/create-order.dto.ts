import { IsNotEmpty, IsString, IsEmail, IsOptional, IsEnum, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';

export class ShippingInfoDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  address: string;

}

export class OrderItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;


  @IsNumber()
  @Min(1)
  quantity: number;

  // ✅ HỖ TRỢ variantId (optional vì frontend có thể gửi)
  @IsOptional()
  @IsString()
  variantId?: string;
}

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => ShippingInfoDto)
  shippingInfo: ShippingInfoDto;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;

  // ❌ BỎ createFromCart hoàn toàn

  // ✅ items là BẮT BUỘC
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}