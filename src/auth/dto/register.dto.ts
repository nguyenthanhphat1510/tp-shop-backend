import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
        type: String
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        description: 'User password (minimum 6 characters)',
        example: '123456',
        type: String,
        minLength: 6
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiPropertyOptional({
        description: 'User full name',
        example: 'John Doe',
        type: String
    })
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional({
        description: 'Whether the user account is active',
        example: true,
        type: Boolean,
        default: true
    })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}