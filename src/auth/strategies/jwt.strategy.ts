import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private usersService: UsersService,
        private configService: ConfigService,
    ) {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        console.log('JWT_SECRET in strategy:', jwtSecret); // Debug log

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret || 'TpShop_S3cur3_K3y_8a47f2c9d6e0b5a1_$!%&*()_XyZ123', // Fallback
        });
    }

    async validate(payload: any) {
        try {
            console.log('JWT Payload received:', payload);

            const user = await this.usersService.findOne(payload.sub);
            if (!user) {
                console.log('User not found for ID:', payload.sub);
                throw new UnauthorizedException('User không tồn tại');
            }

            console.log('User found:', user.email);

            return {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
            };

        } catch (error) {
            console.error('JWT validation error:', error);

            if (error instanceof UnauthorizedException) {
                throw error;
            }

            throw new UnauthorizedException('Token không hợp lệ');
        }
    }
}