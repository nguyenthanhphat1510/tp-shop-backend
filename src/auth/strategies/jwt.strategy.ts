import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private usersService: UsersService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'TpShop_S3cur3_K3y_8a47f2c9d6e0b5a1_$!%&*()_XyZ123',
        });
    }

    async validate(payload: any) {
        try {
            console.log('JWT Payload received:', payload);
            // FIX: Thử tìm user bằng email trước
            let user = await this.usersService.findByEmail(payload.email);
            
            if (!user) {
                // FIX: Nếu không tìm thấy bằng email, thử bằng ID
                console.log('👤 User not found by email, trying by ID...');
                try {
                    user = await this.usersService.findOne(payload.id || payload.sub);
                } catch (idError) {
                    console.log('❌ User not found by ID either:', idError.message);
                }
            }

            if (!user) {
                console.log('❌ JWT validation failed: User not found');
                throw new UnauthorizedException('User không tồn tại');
            }

            console.log('✅ JWT validation successful:', user.email);
            
            // FIX: Trả về user data đầy đủ
            return {
                id: user._id.toString(),
                email: user.email,
                role: user.role,
                fullName: user.fullName,
                avatar: user.avatar,
            };
        } catch (error) {
            console.error('JWT validation error:', error);
            throw new UnauthorizedException('Token không hợp lệ');
        }
    }
}