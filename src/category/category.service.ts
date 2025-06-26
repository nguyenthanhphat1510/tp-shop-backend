import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: MongoRepository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    try {
      // Kiểm tra xem category đã tồn tại chưa
      const existingCategory = await this.categoryRepository.findOne({
        where: { name: createCategoryDto.name }
      });
      
      if (existingCategory) {
        throw new BadRequestException(`Danh mục với tên "${createCategoryDto.name}" đã tồn tại`);
      }

      // Tạo category mới
      const newCategory = this.categoryRepository.create(createCategoryDto);
      return this.categoryRepository.save(newCategory);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Không thể tạo danh mục. Vui lòng thử lại sau.');
    }
  }

  // Giữ nguyên các phương thức khác nhưng chưa triển khai đầy đủ
  // findAll() {
  //   return `This action returns all category`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} category`;
  // }

  // update(id: number, updateCategoryDto: UpdateCategoryDto) {
  //   return `This action updates a #${id} category`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} category`;
  // }
}
