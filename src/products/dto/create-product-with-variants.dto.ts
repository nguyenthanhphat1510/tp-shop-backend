// File: src/products/dto/create-product-with-variants.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested, Min } from 'class-validator';
import { CreateVariantDto } from './create-variant.dto';

export class CreateProductWithVariantsDto {
    // 📱 Thông tin sản phẩm chính
    @IsString()
    @IsNotEmpty()
    name: string; // "iPhone 16"

    @IsString()
    description: string;


    @IsString()
    brand: string; // "Apple"

    @IsString()
    categoryId: string;

    @IsString()
    subcategoryId: string;

    // 🎨 Danh sách variants (mỗi variant có ảnh riêng)
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateVariantDto)
    variants: CreateVariantDto[];
}