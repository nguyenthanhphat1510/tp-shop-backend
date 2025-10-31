import { IsString, IsOptional, IsArray, ValidateNested, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateVariantDto {
  @IsString()
  _id: string; // ✅ BẮT BUỘC

  @IsString()
  storage: string;

  @IsString()
  color: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantDto)
  variants?: UpdateVariantDto[];
}