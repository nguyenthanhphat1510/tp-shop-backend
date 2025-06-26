import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository, ObjectId } from 'typeorm';
import { Subcategory } from './entities/subcategory.entity';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { Category } from '../category/entities/category.entity';

@Injectable()
export class SubcategoryService {
  constructor(
    @InjectRepository(Subcategory)
    private subcategoryRepository: MongoRepository<Subcategory>,
    @InjectRepository(Category)
    private categoryRepository: MongoRepository<Category>,
  ) {}

  async create(createSubcategoryDto: CreateSubcategoryDto): Promise<Subcategory> {
    try {
      // Kiểm tra xem category có tồn tại không
      const category = await this.categoryRepository.findOne({
        where: { _id: new ObjectId(createSubcategoryDto.categoryId) }
      });

      if (!category) {
        throw new NotFoundException(`Không tìm thấy danh mục với ID ${createSubcategoryDto.categoryId}`);
      }

      // Kiểm tra xem subcategory đã tồn tại chưa
      const existingSubcategory = await this.subcategoryRepository.findOne({
        where: { name: createSubcategoryDto.name }
      });
      
      if (existingSubcategory) {
        throw new BadRequestException(`Danh mục con với tên "${createSubcategoryDto.name}" đã tồn tại`);
      }

      // Tạo subcategory mới
      const newSubcategory = this.subcategoryRepository.create(createSubcategoryDto);
      return this.subcategoryRepository.save(newSubcategory);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Không thể tạo danh mục con. Vui lòng thử lại sau.');
    }
  }

  findAll() {
    return `This action returns all subcategory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} subcategory`;
  }

  update(id: number, updateSubcategoryDto: UpdateSubcategoryDto) {
    return `This action updates a #${id} subcategory`;
  }

  remove(id: number) {
    return `This action removes a #${id} subcategory`;
  }
}
