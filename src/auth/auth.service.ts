import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    // Tạo người dùng mới
    const newUser = await this.usersService.create(registerDto);

    // Loại bỏ password trước khi trả về
    const { password, ...result } = newUser as any;

    return {
      message: 'Đăng ký thành công',
      user: result,
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

    // Tạo payload cho JWT
    const payload = { sub: user.id, email: user.email };
    
    // Loại bỏ password trước khi trả về
    const { password, ...result } = user as any;

    // Tạo và trả về token
    return {
      access_token: this.jwtService.sign(payload),
      user: result,
    };
  }
}
