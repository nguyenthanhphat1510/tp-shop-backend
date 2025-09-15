import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './user.service'; // FIX: Import UsersService
import { UserController } from './user.controller';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UsersService], // FIX: Sử dụng UsersService
  exports: [UsersService], // FIX: Export UsersService
})
export class UserModule {}
