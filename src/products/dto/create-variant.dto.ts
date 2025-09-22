// File: src/products/dto/create-variant.dto.ts
import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, Min } from 'class-validator';

export class CreateVariantDto {
  @IsString()
  storage: string; // "128GB"

  @IsString()
  color: string; // "Đen"

  @IsNumber()
  @Min(0)
  price: number; // 22000000

  @IsNumber()
  @Min(0)
  stock: number; // 50

  @IsOptional()
  @IsArray()
  imageUrls?: string[]; // Ảnh riêng cho variant

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // Mặc định true
}