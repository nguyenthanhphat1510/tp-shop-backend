import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCartDto {
    @IsString()
    productId: string;

    @IsNumber()
    @Min(1)
    @Max(3)
    @IsOptional()
    @Transform(({ value }) => {
        // Ép kiểu từ string sang number
        if (typeof value === 'string') {
            const num = parseInt(value, 10);
            return isNaN(num) ? 1 : num;
        }
        return value || 1;
    })
    quantity?: number;
}