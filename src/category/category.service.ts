import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: MongoRepository<Category>,
    @InjectRepository(Product)
    private productRepository: MongoRepository<Product>,
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
      const newCategory = this.categoryRepository.create({
        ...createCategoryDto,
        isActive: createCategoryDto.isActive !== undefined ? createCategoryDto.isActive : true,
      });
      return this.categoryRepository.save(newCategory);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Không thể tạo danh mục. Vui lòng thử lại sau.');
    }
  }

  async findAll(): Promise<Category[]> {
    // ✅ Bỏ filter isActive, trả về tất cả categories
    return this.categoryRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async findOne(id: string): Promise<Category> {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const objectId = new ObjectId(id);
    
    // ✅ Bỏ filter isActive, tìm category bất kể trạng thái
    const category = await this.categoryRepository.findOne({
      where: { _id: objectId }
    });
    
    if (!category) {
      throw new BadRequestException(`Không tìm thấy danh mục với ID ${id}`);
    }
    
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    try {
      // Kiểm tra ObjectId hợp lệ
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);
      
      // Kiểm tra category có tồn tại không
      const existingCategory = await this.categoryRepository.findOne({
        where: { _id: objectId }
      });
      
      if (!existingCategory) {
        throw new BadRequestException(`Không tìm thấy danh mục với ID ${id}`);
      }

      // Nếu có thay đổi tên, kiểm tra tên mới có bị trùng không
      if (updateCategoryDto.name && updateCategoryDto.name !== existingCategory.name) {
        const duplicateCategory = await this.categoryRepository.findOne({
          where: { name: updateCategoryDto.name }
        });
        
        if (duplicateCategory) {
          throw new BadRequestException(`Danh mục với tên "${updateCategoryDto.name}" đã tồn tại`);
        }
      }

      // Cập nhật category
      await this.categoryRepository.update(objectId, {
        ...updateCategoryDto,
        updatedAt: new Date()
      });
      return this.findOne(id);
    } catch (error) {
      console.error('Update category error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Không thể cập nhật danh mục. Vui lòng thử lại sau.');
    }
  }

  // ✅ Toggle status (true ↔ false) với kiểm tra sản phẩm
  async toggleStatus(id: string): Promise<Category> {
    try {
      console.log(`🔄 Toggling category status: ID=${id}`);
      
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID danh mục không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);
      
      // Find current category
      const existingCategory = await this.categoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingCategory) {
        throw new BadRequestException(`Không tìm thấy danh mục với ID: ${id}`);
      }

      // Handle both string and boolean isActive values
      let currentStatus: boolean;
      if (typeof existingCategory.isActive === 'string') {
        currentStatus = existingCategory.isActive === 'true';
      } else {
        currentStatus = Boolean(existingCategory.isActive);
      }

      const newStatus = !currentStatus;

      // Nếu đang chuyển từ active sang inactive, kiểm tra có sản phẩm không
      if (currentStatus === true && newStatus === false) {
        const productsInCategory = await this.productRepository.count({
          where: { 
            categoryId: objectId,
            isActive: true 
          }
        });

        if (productsInCategory > 0) {
          throw new BadRequestException(
            `Không thể vô hiệu hóa danh mục "${existingCategory.name}" vì còn ${productsInCategory} sản phẩm đang hoạt động. Vui lòng vô hiệu hóa tất cả sản phẩm trong danh mục trước.`
          );
        }
      }

      // Update status
      await this.categoryRepository.update(
        { _id: objectId },
        { 
          isActive: newStatus,
          updatedAt: new Date()
        }
      );

      // Get updated category
      const updatedCategory = await this.categoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!updatedCategory) {
        throw new BadRequestException(`Không thể lấy danh mục đã cập nhật với ID: ${id}`);
      }

      console.log(`✅ Category status toggled: ${existingCategory.name} -> ${newStatus ? 'active' : 'inactive'}`);
      return updatedCategory;

    } catch (error) {
      console.error('❌ Error toggling category status:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi thay đổi trạng thái danh mục: ${error.message}`);
    }
  }

  // ✅ Soft delete (always set to false) với kiểm tra sản phẩm
  async softDelete(id: string): Promise<Category> {
    try {
      console.log(`🗑️ Soft deleting category: ID=${id}`);
      
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID danh mục không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);
      
      // Find category
      const existingCategory = await this.categoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingCategory) {
        throw new BadRequestException(`Không tìm thấy danh mục với ID: ${id}`);
      }

      // Kiểm tra có sản phẩm trong danh mục không
      const productsInCategory = await this.productRepository.count({
        where: { 
          categoryId: objectId,
          isActive: true 
        }
      });

      if (productsInCategory > 0) {
        throw new BadRequestException(
          `Không thể xóa danh mục "${existingCategory.name}" vì còn ${productsInCategory} sản phẩm đang hoạt động. Vui lòng xóa hoặc chuyển tất cả sản phẩm sang danh mục khác trước.`
        );
      }

      // Always set to false when deleting
      await this.categoryRepository.update(
        { _id: objectId },
        { 
          isActive: false,
          updatedAt: new Date()
        }
      );

      // Get updated category
      const updatedCategory = await this.categoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!updatedCategory) {
        throw new BadRequestException(`Không thể lấy danh mục đã cập nhật với ID: ${id}`);
      }

      console.log(`✅ Category soft deleted: ${existingCategory.name}`);
      return updatedCategory;

    } catch (error) {
      console.error('❌ Error soft deleting category:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi xóa danh mục: ${error.message}`);
    }
  }

  async remove(id: string): Promise<void> {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const objectId = new ObjectId(id);
    await this.categoryRepository.delete(objectId);
  }
}
