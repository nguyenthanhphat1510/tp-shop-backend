import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository, ObjectId } from 'typeorm';
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
      // Kiểm tra tên category đã tồn tại chưa
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

  async findAll(): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { isActive: true }
    });
  }

  async findOne(id: string): Promise<Category> {
    const objectId = new ObjectId(id);
    const category = await this.categoryRepository.findOne({
      where: { _id: objectId }
    });
    
    if (!category) {
      throw new BadRequestException(`Không tìm thấy danh mục với ID ${id}`);
    }
    
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const objectId = new ObjectId(id);
    await this.categoryRepository.update(objectId, updateCategoryDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const objectId = new ObjectId(id);
    await this.categoryRepository.delete(objectId);
  }
}
