import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    console.log('Headers:', request.headers); // Kiểm tra headers
    console.log('Authorization:', request.headers.authorization); // Kiểm tra auth header
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    console.log('JWT Error:', err);
    console.log('JWT User:', user);
    console.log('JWT Info:', info);
    if (err || !user) {
      throw err || new UnauthorizedException('Token không hợp lệ');
    }
    return user;
  }
}