import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    // Tạo người dùng mới
    const newUser = await this.usersService.create(registerDto);
    const { password, ...result } = newUser as any;

    return {
      success: true,
      message: 'Đăng ký thành công',
      user: {
        id: result.id,
        email: result.email,
        name: result.fullName || result.email.split('@')[0]
      },
    };
  }

  async login(loginDto: LoginDto) {
    // Tìm người dùng theo email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // ✅ Tạo cả Access Token và Refresh Token
    const tokens = await this.generateTokens(user);
    const { password, ...result } = user as any;

    return {
      success: true,
      message: 'Đăng nhập thành công',
      token: tokens.accessToken,      // ✅ Access token
      refreshToken: tokens.refreshToken, // ✅ Refresh token
      user: {
        id: result.id,
        email: result.email,
        name: result.fullName || result.email.split('@')[0]
      },
    };
  }

  // ✅ Thêm method tạo tokens
  async generateTokens(user: any) {
    const payload = { 
      sub: user.id, 
      email: user.email,
      type: 'access'
    };

    const refreshPayload = {
      sub: user.id,
      email: user.email,
      type: 'refresh'
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET') || 'TpShop_S3cur3_K3y_8a47f2c9d6e0b5a1_$!%&*()_XyZ123',
      expiresIn: '15m', // ✅ Access token ngắn hạn
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET') || 'TpShop_R3fr3sh_S3cur3_K3y_9b58g3d7f1c0a6b2_#@$^&*',
      expiresIn: '7d', // ✅ Refresh token dài hạn
    });

    return {
      accessToken,
      refreshToken
    };
  }

  // ✅ Thêm method refresh token
  async refreshTokens(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET') || 'TpShop_R3fr3sh_S3cur3_K3y_9b58g3d7f1c0a6b2_#@$^&*',
      });

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.usersService.findOne(decoded.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = await this.generateTokens(user);

      return {
        success: true,
        message: 'Token refreshed successfully',
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };

    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ✅ Thêm logout method
  async logout() {
    return {
      success: true,
      message: 'Đăng xuất thành công'
    };
  }
}
