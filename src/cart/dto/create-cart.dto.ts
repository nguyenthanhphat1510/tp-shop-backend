import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateCartDto {
    @IsString()
    @IsNotEmpty()
    productId: string;

    @IsNumber()
    @IsOptional()
    @Min(1)
    @Max(3)
    quantity?: number = 1;
}