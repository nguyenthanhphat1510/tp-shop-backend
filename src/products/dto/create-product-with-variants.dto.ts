// File: src/products/dto/create-product-with-variants.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { CreateVariantDto } from './create-variant.dto';

export class CreateProductWithVariantsDto {
    // 📱 Thông tin sản phẩm chính
    @IsString()
    @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
    name: string; // "iPhone 16"

    @IsString()
    @IsNotEmpty({ message: 'Mô tả không được để trống' })
    description: string;


    @IsString()
    @IsNotEmpty({ message: 'ID danh mục không được để trống' })
    categoryId: string;

    @IsString()
    @IsNotEmpty({ message: 'ID danh mục con không được để trống' })
    subcategoryId: string;

    // 🎨 Danh sách variants (mỗi variant có ảnh riêng)
    @IsArray()
    @ArrayMinSize(1, { message: 'Phải có ít nhất 1 biến thể' })
    @ValidateNested({ each: true })
    @Type(() => CreateVariantDto)
    variants: CreateVariantDto[];
}