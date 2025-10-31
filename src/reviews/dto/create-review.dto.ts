import { IsNotEmpty, IsNumber, IsString, Min, Max } from 'class-validator';

export class CreateReviewDto {
    @IsNotEmpty()
    variant_id: string;

    @IsNotEmpty()
    order_id: string; // ✅ Thêm order_id - bắt buộc

    @IsNumber()
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    @IsNotEmpty()
    comment: string;
}