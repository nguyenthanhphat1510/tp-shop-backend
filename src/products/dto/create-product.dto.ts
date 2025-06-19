import { IsNotEmpty, IsNumber, IsString, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateProductDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    price: number;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsNotEmpty()
    @IsString()
    category: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    stock?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
