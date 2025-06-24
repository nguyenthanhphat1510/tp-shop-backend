import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository, ObjectId } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: MongoRepository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });
    return this.usersRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string | ObjectId): Promise<User> {
    const user = await this.usersRepository.findOne({ 
      where: { _id: new ObjectId(id.toString()) } 
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string | ObjectId, updateUserDto: UpdateUserDto): Promise<User> {
    const result = await this.usersRepository.findOneAndUpdate(
      { _id: new ObjectId(id.toString()) },
      {
        $set: {
          ...(updateUserDto.fullName && { fullName: updateUserDto.fullName }),
          ...(updateUserDto.email && { email: updateUserDto.email }),
          ...(updateUserDto.isActive !== undefined && { isActive: updateUserDto.isActive }),
          ...(updateUserDto.password && { 
            password: await bcrypt.hash(updateUserDto.password, 10) 
          }),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result || !result.value) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return result.value;
  }

  async remove(id: string | ObjectId): Promise<void> {
    const result = await this.usersRepository.deleteOne({ _id: new ObjectId(id.toString()) });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }
}
