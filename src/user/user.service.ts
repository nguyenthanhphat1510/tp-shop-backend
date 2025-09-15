import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ObjectId } from 'mongodb';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      // Hash password only if provided
      if (createUserDto.password) {
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        createUserDto.password = hashedPassword;
      }

      const user = this.usersRepository.create(createUserDto);
      return await this.usersRepository.save(user);
    } catch (error) {
      console.error('❌ Create user error:', error);
      throw new Error('Failed to create user');
    }
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string | ObjectId): Promise<User> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;

      // FIX: Truy vấn bằng _id thay vì id
      const user = await this.usersRepository.findOne({
        where: { _id: objectId }
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.usersRepository.findOne({ where: { email } });
      return user || null;
    } catch (error) {
      console.error('❌ Find user by email error:', error);
      return null;
    }
  }

  async update(id: string | ObjectId, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;

      // FIX: Truy vấn bằng _id thay vì id
      const existingUser = await this.usersRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (updateUserDto.password) {
        const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
        updateUserDto.password = hashedPassword;
      }

      const updatedUser = this.usersRepository.merge(existingUser, updateUserDto);
      const savedUser = await this.usersRepository.save(updatedUser);

      return savedUser;
    } catch (error) {
      throw error;
    }
  }

  async remove(id: string | ObjectId): Promise<void> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    // FIX: Xóa bằng _id thay vì id
    const result = await this.usersRepository.delete({ _id: objectId });

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }
}
