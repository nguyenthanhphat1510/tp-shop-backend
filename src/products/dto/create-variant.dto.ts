// src/products/dto/create-variant.dto.ts
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateVariantDto {
    @IsString()
    @IsNotEmpty({ message: 'storage is required' })
    @Transform(({ value }) => (value ?? '').toString().trim())
    storage!: string;

    @IsString()
    @IsNotEmpty({ message: 'color is required' })
    @Transform(({ value }) => (value ?? '').toString().trim())
    color!: string;

    @Type(() => Number)
    @Min(1, { message: 'price must be greater than 0' })
    price!: number;

    @Type(() => Number)
    @IsInt({ message: 'stock must be an integer' })
    @Min(0, { message: 'stock must be 0 or greater' })
    stock!: number;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() !== 'false';
        return true;
    })
    isActive?: boolean;
}
