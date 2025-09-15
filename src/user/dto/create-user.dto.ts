import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsOptional() // FIX: Password optional và có thể null
    @IsString()
    password?: string | null; // FIX: Cho phép null

    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsString()
    role?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional() // THÊM: Google fields
    @IsString()
    googleId?: string;

    @IsOptional()
    @IsString()
    avatar?: string;

    @IsOptional()
    @IsString()
    lastLoginMethod?: string;

    @IsOptional()
    lastLoginAt?: Date;
}
