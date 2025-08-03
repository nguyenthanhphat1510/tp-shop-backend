import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ObjectId } from 'typeorm';

export class CreateSubcategoryDto {
    @IsString()
    @IsNotEmpty({ message: 'Tên danh mục con không được để trống' })
    name: string;

    @IsString()
    @IsNotEmpty({ message: 'ID danh mục cha không được để trống' })
    @Transform(({ value }) => {
        // Import ObjectId từ mongodb để transform
        const { ObjectId: MongoObjectId } = require('mongodb');
        return new MongoObjectId(value);
    })
    categoryId: ObjectId; // ✅ Đổi thành ObjectId

    @IsBoolean()
    @IsOptional()
    isActive?: boolean = true;
}
