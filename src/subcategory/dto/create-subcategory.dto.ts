import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateSubcategoryDto {
    @IsString()
    @IsNotEmpty({ message: 'Tên danh mục con không được để trống' })
    name: string;

    @IsString()
    @IsNotEmpty({ message: 'ID danh mục cha không được để trống' })
    categoryId: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
