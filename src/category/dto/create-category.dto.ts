import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateCategoryDto {
    @IsString()
    @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
    name: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true; // ✅ Default value
}
