import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @IsOptional()
    @IsString()
    googleId?: string; // THÊM: Cho phép cập nhật Google ID

    @IsOptional()
    @IsString()
    avatar?: string; // THÊM: Cho phép cập nhật avatar

    @IsOptional()
    lastLoginAt?: Date;

    @IsOptional()
    @IsString()
    lastLoginMethod?: string;
}
