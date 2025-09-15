import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async register(registerDto: RegisterDto) {
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    // Đăng ký - thêm role vào response
    const newUser = await this.usersService.create(registerDto);
    const { password, ...result } = newUser as any;

    return {
      success: true,
      message: 'Đăng ký thành công',
      user: {
        id: result._id?.toString(),
        email: result.email,
        name: result.fullName || result.email.split('@')[0],
        role: result.role || 'user' // ✅ Thêm role
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

    // Đăng nhập - thêm role vào response  
    const tokens = await this.generateTokens(user);
    const { password, ...result } = user as any;

    return {
      success: true,
      message: 'Đăng nhập thành công',
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: result._id?.toString(),
        email: result.email,
        name: result.fullName || result.email.split('@')[0],
        role: result.role || 'user' // ✅ Thêm role
      },
    };
  }

  async generateTokens(user: any) {
    const payload = {
      sub: user._id?.toString(),
      email: user.email,
      type: 'access'
    };

    const refreshPayload = {
      sub: user._id?.toString(),
      email: user.email,
      type: 'refresh'
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET') || 'TpShop_S3cur3_K3y_8a47f2c9d6e0b5a1_$!%&*()_XyZ123',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET') || 'TpShop_R3fr3sh_S3cur3_K3y_9b58g3d7f1c0a6b2_#@$^&*',
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken
    };
  }

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

  async logout() {
    return {
      success: true,
      message: 'Đăng xuất thành công'
    };
  }

  async validateGoogleUser(googleUser: any) {
    try {
      console.log('🔍 Validating Google user:', googleUser.email);

      // 1. Tìm user theo email
      let user = await this.usersService.findByEmail(googleUser.email);

      if (user) {
        console.log('👤 Found existing user:', {
          id: user._id?.toString(),
          email: user.email,
          hasGoogleId: !!user.googleId
        });

        // 2. Nếu chưa có Google ID → Liên kết account
        if (!user.googleId) {
          console.log('🔗 Linking Google account...');
          try {
            const updatedUser = await this.usersService.update(user._id, {
              googleId: googleUser.googleId,
              avatar: googleUser.picture,
              lastLoginAt: new Date(),
              lastLoginMethod: 'google',
            });
            console.log('✅ Google account linked successfully');
            user = updatedUser;
          } catch (updateError) {
            console.error('❌ Failed to link Google account:', updateError);
            console.log('⚠️ Continuing with existing user without linking');
          }
        } else {
          console.log('✅ User already has Google account linked');
        }
      } else {
        console.log('✨ Creating new Google user...');
        const newUserData: CreateUserDto = {
          email: googleUser.email,
          fullName: `${googleUser.firstName} ${googleUser.lastName}`,
          password: null,
          role: 'user',
          isActive: true,
          googleId: googleUser.googleId,
          avatar: googleUser.picture,
          lastLoginMethod: 'google',
          lastLoginAt: new Date(),
        };

        user = await this.usersService.create(newUserData);
        console.log('✅ New Google user created:', user.email);
      }

      if (!user) {
        throw new Error('Failed to create or find user');
      }

      console.log('✅ Google user validated successfully:', user.email);
      return user;

    } catch (error) {
      console.error('❌ Google validation error:', error);
      throw new Error('Google authentication failed');
    }
  }

  async loginWithGoogle(user: any) {
    // ...existing code...
    const payload = { sub: user.id, email: user.email, type: 'access' };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'secret',
      expiresIn: '15m',
    });

    // ✅ Thêm refreshToken giống như login thường
    const refreshPayload = { sub: user.id, email: user.email, type: 'refresh' };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      expiresIn: '7d',
    });

    return {
      success: true,
      message: 'Đăng nhập Google thành công',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
        },
        accessToken,
        refreshToken, // ✅ Trả về refreshToken
      },
    };
  }
}
