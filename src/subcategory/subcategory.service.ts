import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository, ObjectId } from 'typeorm';
import { ObjectId as MongoObjectId } from 'mongodb'; // Import để tạo ObjectId
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
      console.log('Creating subcategory with data:', createSubcategoryDto);
      
      // Chuyển đổi categoryId từ string thành ObjectId
      let categoryObjectId: ObjectId;
      
      if (typeof createSubcategoryDto.categoryId === 'string') {
        categoryObjectId = new MongoObjectId(createSubcategoryDto.categoryId);
      } else {
        categoryObjectId = createSubcategoryDto.categoryId;
      }

      console.log('Category ObjectId:', categoryObjectId);

      // Tìm category
      const category = await this.categoryRepository.findOne({
        where: { _id: categoryObjectId }
      });

      if (!category) {
        throw new NotFoundException(`Không tìm thấy danh mục với ID ${createSubcategoryDto.categoryId}`);
      }

      // Kiểm tra tên subcategory đã tồn tại chưa
      const existingSubcategory = await this.subcategoryRepository.findOne({
        where: { name: createSubcategoryDto.name }
      });
      
      if (existingSubcategory) {
        throw new BadRequestException(`Danh mục con với tên "${createSubcategoryDto.name}" đã tồn tại`);
      }

      // Tạo subcategory mới với categoryId là ObjectId
      const subcategoryData = {
        ...createSubcategoryDto,
        categoryId: categoryObjectId // Đảm bảo categoryId là ObjectId
      };

      const newSubcategory = this.subcategoryRepository.create(subcategoryData);
      return this.subcategoryRepository.save(newSubcategory);
      
    } catch (error) {
      console.error('Error in create subcategory:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi tạo danh mục con: ${error.message}`);
    }
  }

  async findAll(): Promise<Subcategory[]> {
    return this.subcategoryRepository.find({
      where: { isActive: true }
    });
  }

  async findByCategoryId(categoryId: string): Promise<Subcategory[]> {
    const categoryObjectId = new MongoObjectId(categoryId);
    return this.subcategoryRepository.find({
      where: { 
        categoryId: categoryObjectId, 
        isActive: true 
      }
    });
  }

  async findOne(id: string): Promise<Subcategory> {
    const objectId = new MongoObjectId(id);
    const subcategory = await this.subcategoryRepository.findOne({
      where: { _id: objectId }
    });
    
    if (!subcategory) {
      throw new BadRequestException(`Không tìm thấy danh mục con với ID ${id}`);
    }
    
    return subcategory;
  }

  // async update(id: string, updateSubcategoryDto: UpdateSubcategoryDto): Promise<Subcategory> {
  //   const objectId = new MongoObjectId(id);
    
  //   // Nếu có categoryId trong update, chuyển thành ObjectId
  //   if (updateSubcategoryDto.categoryId) {
  //     updateSubcategoryDto.categoryId = new MongoObjectId(updateSubcategoryDto.categoryId as string) as any;
  //   }
    
  //   await this.subcategoryRepository.update(objectId, updateSubcategoryDto);
  //   return this.findOne(id);
  // }

  // async remove(id: string): Promise<void> {
  //   const objectId = new MongoObjectId(id);
  //   await this.subcategoryRepository.delete(objectId);
  // }
}
