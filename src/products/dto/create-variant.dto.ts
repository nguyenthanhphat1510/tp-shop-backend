// File: src/products/dto/create-variant.dto.ts
import { IsNotEmpty, IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateVariantDto {
    @IsString()
    @IsNotEmpty({ message: 'Dung lượng không được để trống' })
    storage: string; // "128GB", "256GB", "512GB"

    @IsString()
    @IsNotEmpty({ message: 'Màu sắc không được để trống' })
    color: string; // "Đen", "Trắng", "Xanh Dương"

    @Transform(({ value }) => Number(value))
    @IsNumber({}, { message: 'Giá phải là số' })
    @IsNotEmpty({ message: 'Giá không được để trống' })
    price: number;

    @Transform(({ value }) => Number(value))
    @IsNumber({}, { message: 'Số lượng phải là số' })
    @IsNotEmpty({ message: 'Số lượng không được để trống' })
    stock: number;

    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    @IsOptional()
    isActive?: boolean = true;
}