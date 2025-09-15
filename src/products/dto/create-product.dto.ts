import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ObjectId } from 'typeorm';

export class CreateProductDto {
    @IsString()
    @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber({}, { message: 'Giá phải là số' })
    @Min(0, { message: 'Giá không được âm' })
    @Transform(({ value }) => parseFloat(value))
    price: number;

    @IsString()
    @IsNotEmpty({ message: 'ID danh mục không được để trống' })
    @Transform(({ value }) => {
        const { ObjectId: MongoObjectId } = require('mongodb');
        return new MongoObjectId(value);
    })
    categoryId: ObjectId;

    @IsString()
    @IsNotEmpty({ message: 'ID danh mục con không được để trống' })
    @Transform(({ value }) => {
        const { ObjectId: MongoObjectId } = require('mongodb');
        return new MongoObjectId(value);
    })
    subcategoryId: ObjectId;

    @IsNumber({}, { message: 'Số lượng phải là số' })
    @Min(0, { message: 'Số lượng không được âm' })
    @Transform(({ value }) => parseInt(value))
    @IsOptional()
    stock?: number;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value === 'true';
        return true;
    })
    isActive?: boolean;
}
