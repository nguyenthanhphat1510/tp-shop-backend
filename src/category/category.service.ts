import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Product } from '../products/entities/product.entity';
import { Subcategory } from '../subcategory/entities/subcategory.entity'; // ✅ IMPORT

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: MongoRepository<Category>,
    @InjectRepository(Product)
    private productRepository: MongoRepository<Product>,
    @InjectRepository(Subcategory) // ✅ INJECT
    private subCategoryRepository: MongoRepository<Subcategory>,
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
      
      // ===== BƯỚC 1: TÌM CATEGORY =====
      const existingCategory = await this.categoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingCategory) {
        throw new BadRequestException(`Không tìm thấy danh mục với ID: ${id}`);
      }

      // ===== BƯỚC 2: XÁC ĐỊNH TRẠNG THÁI HIỆN TẠI =====
      let currentStatus: boolean;
      if (typeof existingCategory.isActive === 'string') {
        currentStatus = existingCategory.isActive === 'true';
      } else {
        currentStatus = Boolean(existingCategory.isActive);
      }

      const newStatus = !currentStatus;

      console.log(`Current status: ${currentStatus} → New status: ${newStatus}`);

      // ===== BƯỚC 3: KIỂM TRA RÀNG BUỘC KHI CHUYỂN ACTIVE → INACTIVE =====
      if (currentStatus === true && newStatus === false) {
        console.log('⚠️ Attempting to deactivate category, checking constraints...');

        // ✅ KIỂM TRA SUBCATEGORIES ĐANG HOẠT ĐỘNG
        const activeSubCategories = await this.subCategoryRepository.count({
          where: { 
            categoryId: objectId,
            isActive: true 
          }
        });

        if (activeSubCategories > 0) {
          throw new BadRequestException(
            `❌ Không thể vô hiệu hóa danh mục "${existingCategory.name}" vì còn ${activeSubCategories} danh mục con đang hoạt động.\n\n` +
            `Vui lòng vô hiệu hóa tất cả danh mục con trước.`
          );
        }

        console.log(`✅ No active subcategories found`);

        // ✅ KIỂM TRA PRODUCTS ĐANG HOẠT ĐỘNG
        const activeProducts = await this.productRepository.count({
          where: { 
            categoryId: objectId,
            isActive: true 
          }
        });

        if (activeProducts > 0) {
          throw new BadRequestException(
            `❌ Không thể vô hiệu hóa danh mục "${existingCategory.name}" vì còn ${activeProducts} sản phẩm đang hoạt động.\n\n` +
            `Vui lòng vô hiệu hóa hoặc chuyển tất cả sản phẩm sang danh mục khác trước.`
          );
        }

        console.log(`✅ No active products found`);
      }

      // ===== BƯỚC 4: CÁC KIỂM TRA BỔ SUNG KHI CHUYỂN INACTIVE → ACTIVE =====
      if (currentStatus === false && newStatus === true) {
        console.log('ℹ️ Reactivating category (no constraints needed)');
        
        // ✅ OPTIONAL: Kiểm tra subcategories có tồn tại không
        const totalSubCategories = await this.subCategoryRepository.count({
          where: { categoryId: objectId }
        });

        if (totalSubCategories === 0) {
          console.warn(`⚠️ Warning: Category "${existingCategory.name}" has no subcategories`);
        }
      }

      // ===== BƯỚC 5: CẬP NHẬT TRẠNG THÁI =====
      await this.categoryRepository.update(
        { _id: objectId },
        { 
          isActive: newStatus,
          updatedAt: new Date()
        }
      );

      // ===== BƯỚC 6: TRẢ VỀ CATEGORY ĐÃ CẬP NHẬT =====
      const updatedCategory = await this.categoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!updatedCategory) {
        throw new BadRequestException(`Không thể lấy danh mục đã cập nhật với ID: ${id}`);
      }

      console.log(`✅ Category status toggled successfully: ${existingCategory.name} → ${newStatus ? 'ACTIVE' : 'INACTIVE'}`);
      
      return updatedCategory;

    } catch (error) {
      console.error('❌ Error toggling category status:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi thay đổi trạng thái danh mục: ${error.message}`);
    }
  }

  // ✅ HARD DELETE - XÓA VĨNH VIỄN KHỎI DATABASE
async remove(id: string): Promise<{ message: string; deletedCategory: { id: string; name: string } }> {
  try {
    console.log(`🗑️ Hard deleting category: ID=${id}`);
    
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException(`ID danh mục không hợp lệ: ${id}`);
    }

    const objectId = new ObjectId(id);
    
    // ===== BƯỚC 1: TÌM CATEGORY =====
    const existingCategory = await this.categoryRepository.findOne({
      where: { _id: objectId }
    });

    if (!existingCategory) {
      throw new BadRequestException(`Không tìm thấy danh mục với ID: ${id}`);
    }

    console.log(`Found category: "${existingCategory.name}"`);

    // ===== BƯỚC 2: KIỂM TRA SUBCATEGORIES (BẤT KỂ TRẠNG THÁI) =====
    const totalSubCategories = await this.subCategoryRepository.count({
      where: { categoryId: objectId }
    });

    if (totalSubCategories > 0) {
      throw new BadRequestException(
        `❌ Không thể xóa danh mục "${existingCategory.name}" vì còn ${totalSubCategories} danh mục con.\n\n` +
        `Vui lòng xóa tất cả danh mục con trước.`
      );
    }

    console.log(`✅ No subcategories found`);

    // ===== BƯỚC 3: KIỂM TRA PRODUCTS (BẤT KỂ TRẠNG THÁI) =====
    const totalProducts = await this.productRepository.count({
      where: { categoryId: objectId }
    });

    if (totalProducts > 0) {
      throw new BadRequestException(
        `❌ Không thể xóa danh mục "${existingCategory.name}" vì còn ${totalProducts} sản phẩm.\n\n` +
        `Vui lòng xóa hoặc chuyển tất cả sản phẩm sang danh mục khác trước.`
      );
    }

    console.log(`✅ No products found`);

    // ===== BƯỚC 4: XÓA VĨNH VIỄN KHỎI DATABASE =====
    await this.categoryRepository.delete({ _id: objectId });

    console.log(`✅ Category permanently deleted: "${existingCategory.name}"`);

    // ===== BƯỚC 5: TRẢ VỀ THÔNG BÁO =====
    return {
      message: `Đã xóa vĩnh viễn danh mục "${existingCategory.name}" khỏi hệ thống`,
      deletedCategory: {
        id: id,
        name: existingCategory.name
      }
    };

  } catch (error) {
    console.error('❌ Error hard deleting category:', error);
    
    if (error instanceof BadRequestException) {
      throw error;
    }
    
    throw new BadRequestException(`Lỗi xóa danh mục: ${error.message}`);
  }
}
}
