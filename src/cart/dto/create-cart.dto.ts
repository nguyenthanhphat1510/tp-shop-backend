import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateCartDto {
    @IsString()
    @IsNotEmpty()
    productId: string;

    @IsNumber()
    @IsOptional()
    @Min(1)
    @Max(50) // Sửa thành 50 để khớp với logic service
    quantity?: number = 1;
}