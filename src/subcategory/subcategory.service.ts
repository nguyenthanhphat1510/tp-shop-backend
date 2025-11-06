import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository, ObjectId } from 'typeorm';
import { ObjectId as MongoObjectId } from 'mongodb';
import { Subcategory } from './entities/subcategory.entity';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { Category } from '../category/entities/category.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class SubcategoryService {
  constructor(
    @InjectRepository(Subcategory)
    private subcategoryRepository: MongoRepository<Subcategory>,
    @InjectRepository(Category)
    private categoryRepository: MongoRepository<Category>,
    @InjectRepository(Product)
    private productRepository: MongoRepository<Product>,
  ) {}

  // ✅ 1. CREATE - FIX MESSAGE VÀ VALIDATION
  async create(createSubcategoryDto: CreateSubcategoryDto): Promise<Subcategory> {
    try {
      console.log('🆕 Creating subcategory:', createSubcategoryDto);

      // ===== BƯỚC 1: VALIDATE CATEGORY ID =====
      if (!MongoObjectId.isValid(createSubcategoryDto.categoryId)) {
        throw new BadRequestException(`ID danh mục cha không hợp lệ: ${createSubcategoryDto.categoryId}`);
      }

      const categoryObjectId = new MongoObjectId(createSubcategoryDto.categoryId);
      
      // ===== BƯỚC 2: KIỂM TRA CATEGORY CHA TỒN TẠI =====
      const category = await this.categoryRepository.findOne({
        where: { _id: categoryObjectId }
      });

      if (!category) {
        throw new BadRequestException(`Không tìm thấy danh mục cha với ID ${createSubcategoryDto.categoryId}`);
      }

      // ===== BƯỚC 3: KIỂM TRA CATEGORY CHA ĐANG HOẠT ĐỘNG =====
      const isActiveCategory = category.isActive === true || (typeof category.isActive === 'string' && category.isActive === 'true');
      if (!isActiveCategory) {
        throw new BadRequestException(
          `❌ Không thể thêm danh mục con vào "${category.name}" vì danh mục cha đang tạm dừng.\n\n` +
          `Vui lòng kích hoạt danh mục cha hoặc chọn danh mục khác.`
        );
      }

      // ===== BƯỚC 4: VALIDATE & TRIM NAME =====
      const trimmedName = createSubcategoryDto.name.trim();
      
      if (!trimmedName) {
        throw new BadRequestException('Tên danh mục con không được để trống');
      }

      if (trimmedName.length < 2) {
        throw new BadRequestException('Tên danh mục con phải có ít nhất 2 ký tự');
      }

      if (trimmedName.length > 100) {
        throw new BadRequestException('Tên danh mục con không được vượt quá 100 ký tự');
      }

      // ===== BƯỚC 5: KIỂM TRA TÊN TRÙNG LẶP =====
      const existingSubcategory = await this.subcategoryRepository.findOne({
        where: { name: trimmedName }
      });

      if (existingSubcategory) {
        throw new BadRequestException(
          `❌ Danh mục con với tên "${trimmedName}" đã tồn tại.\n\n` +
          `Vui lòng chọn tên khác.`
        );
      }

      // ===== BƯỚC 6: TẠO SUBCATEGORY MỚI =====
      const newSubcategory = this.subcategoryRepository.create({
        name: trimmedName,
        categoryId: categoryObjectId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedSubcategory = await this.subcategoryRepository.save(newSubcategory);

      console.log(`✅ Subcategory created: "${trimmedName}" under category "${category.name}"`);

      return savedSubcategory;

    } catch (error) {
      console.error('❌ Error creating subcategory:', error);
      
      if (error instanceof BadRequestException) {
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
    try {
      console.log('Finding subcategories for categoryId:', categoryId);
      
      const categoryObjectId = new MongoObjectId(categoryId);
      console.log('Converted to ObjectId:', categoryObjectId);
      
      const subcategories = await this.subcategoryRepository.find({
        where: { 
          categoryId: categoryObjectId, 
          isActive: true 
        }
      });
      
      console.log('Found subcategories:', subcategories.length);
      console.log('Subcategories data:', subcategories);
      
      return subcategories;
    } catch (error) {
      console.error('Error in findByCategoryId:', error);
      throw new BadRequestException(`Lỗi tìm danh mục con: ${error.message}`);
    }
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

  
  // ✅ 2. UPDATE - FIX LOGIC KIỂM TRA CATEGORY
  async update(id: string, updateSubcategoryDto: UpdateSubcategoryDto): Promise<Subcategory> {
    try {
      console.log('✏️ Updating subcategory with ID:', id);
      console.log('Update data:', updateSubcategoryDto);

      // ===== BƯỚC 1: VALIDATE ID =====
      if (!MongoObjectId.isValid(id)) {
        throw new BadRequestException(`ID danh mục con không hợp lệ: ${id}`);
      }

      const objectId = new MongoObjectId(id);
      
      // ===== BƯỚC 2: TÌM SUBCATEGORY HIỆN TẠI =====
      const existingSubcategory = await this.subcategoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingSubcategory) {
        throw new BadRequestException(`Không tìm thấy danh mục con với ID ${id}`);
      }

      console.log(`Found subcategory: "${existingSubcategory.name}"`);

      // ===== BƯỚC 3: VALIDATE & CHECK CATEGORY MỚI (CHỈ KHI THỰC SỰ THAY ĐỔI) =====
      let categoryObjectId: MongoObjectId | undefined;
      
      if (updateSubcategoryDto.categoryId) {
        // Convert sang ObjectId
        if (typeof updateSubcategoryDto.categoryId === 'string') {
          if (!MongoObjectId.isValid(updateSubcategoryDto.categoryId)) {
            throw new BadRequestException(`ID danh mục cha không hợp lệ: ${updateSubcategoryDto.categoryId}`);
          }
          categoryObjectId = new MongoObjectId(updateSubcategoryDto.categoryId);
        } else {
          categoryObjectId = updateSubcategoryDto.categoryId;
        }

        // ✅ CHỈ KIỂM TRA KHI THỰC SỰ THAY ĐỔI CATEGORY
        const isCategoryChanged = categoryObjectId.toString() !== existingSubcategory.categoryId.toString();
        
        if (isCategoryChanged) {
          console.log(`⚠️ Changing category from ${existingSubcategory.categoryId} to ${categoryObjectId}`);

          // Kiểm tra category mới có tồn tại không
          const newCategory = await this.categoryRepository.findOne({
            where: { _id: categoryObjectId }
          });

          if (!newCategory) {
            throw new BadRequestException(`Không tìm thấy danh mục cha với ID ${updateSubcategoryDto.categoryId}`);
          }

          // Kiểm tra category mới có đang active không
          const isActiveCategory = newCategory.isActive === true || (typeof newCategory.isActive === 'string' && newCategory.isActive === 'true');
          if (!isActiveCategory) {
            throw new BadRequestException(
              `❌ Không thể chuyển sang danh mục cha "${newCategory.name}" vì danh mục này đang tạm dừng.\n\n` +
              `Vui lòng kích hoạt danh mục cha hoặc chọn danh mục khác.`
            );
          }

          console.log(`✅ New category "${newCategory.name}" is active`);
        } else {
          console.log(`✅ Category ID unchanged, skipping validation`);
          // ✅ Nếu không đổi category, không set lại categoryObjectId
          categoryObjectId = undefined;
        }
      }

      // ===== BƯỚC 4: VALIDATE & CHECK TÊN TRÙNG LẶP (CHỈ KHI THỰC SỰ THAY ĐỔI) =====
      if (updateSubcategoryDto.name) {
        const trimmedName = updateSubcategoryDto.name.trim();
        
        if (!trimmedName) {
          throw new BadRequestException('Tên danh mục con không được để trống');
        }

        if (trimmedName.length < 2) {
          throw new BadRequestException('Tên danh mục con phải có ít nhất 2 ký tự');
        }

        if (trimmedName.length > 100) {
          throw new BadRequestException('Tên danh mục con không được vượt quá 100 ký tự');
        }

        // ✅ CHỈ KIỂM TRA KHI THỰC SỰ THAY ĐỔI TÊN
        if (trimmedName !== existingSubcategory.name) {
          console.log(`⚠️ Changing name from "${existingSubcategory.name}" to "${trimmedName}"`);

          const duplicateSubcategory = await this.subcategoryRepository.findOne({
            where: { name: trimmedName }
          });

          if (duplicateSubcategory && duplicateSubcategory._id.toString() !== id) {
            throw new BadRequestException(
              `❌ Danh mục con với tên "${trimmedName}" đã tồn tại.\n\n` +
              `Vui lòng chọn tên khác.`
            );
          }
        } else {
          console.log(`✅ Name unchanged, skipping duplicate check`);
        }
      }

      // ===== BƯỚC 5: CHUẨN BỊ DỮ LIỆU CẬP NHẬT =====
      const updateData: any = {
        updatedAt: new Date()
      };

      if (updateSubcategoryDto.name) {
        updateData.name = updateSubcategoryDto.name.trim();
      }

      // ✅ CHỈ CẬP NHẬT CATEGORY NẾU THỰC SỰ THAY ĐỔI
      if (categoryObjectId) {
        updateData.categoryId = categoryObjectId;
      }

      console.log('Update data prepared:', updateData);

      // ===== BƯỚC 6: CẬP NHẬT SUBCATEGORY =====
      await this.subcategoryRepository.update({ _id: objectId }, updateData);

      // ===== BƯỚC 7: TRẢ VỀ SUBCATEGORY ĐÃ CẬP NHẬT =====
      const updatedSubcategory = await this.subcategoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!updatedSubcategory) {
        throw new BadRequestException(`Không thể lấy danh mục con đã cập nhật với ID: ${id}`);
      }

      console.log(`✅ Subcategory updated successfully`);

      return updatedSubcategory;

    } catch (error) {
      console.error('❌ Error updating subcategory:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi cập nhật danh mục con: ${error.message}`);
    }
  }

  // ✅ Toggle status với kiểm tra sản phẩm chính xác
  async toggleStatus(id: string): Promise<Subcategory> {
    try {
      console.log(`🔄 Toggling subcategory status: ID=${id}`);
      
      if (!MongoObjectId.isValid(id)) {
        throw new BadRequestException(`ID danh mục con không hợp lệ: ${id}`);
      }

      const objectId = new MongoObjectId(id);
      
      // ===== BƯỚC 1: TÌM SUBCATEGORY =====
      const existingSubcategory = await this.subcategoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingSubcategory) {
        throw new BadRequestException(`Không tìm thấy danh mục con với ID: ${id}`);
      }

      // ===== BƯỚC 2: XÁC ĐỊNH TRẠNG THÁI HIỆN TẠI =====
      let currentStatus: boolean;
      if (typeof existingSubcategory.isActive === 'string') {
        currentStatus = existingSubcategory.isActive === 'true';
      } else {
        currentStatus = Boolean(existingSubcategory.isActive);
      }

      const newStatus = !currentStatus;
      console.log(`Current status: ${currentStatus} → New status: ${newStatus}`);

      // ===== BƯỚC 3: KIỂM TRA RÀNG BUỘC KHI CHUYỂN ACTIVE → INACTIVE =====
      if (currentStatus === true && newStatus === false) {
        console.log('⚠️ Attempting to deactivate subcategory, checking product constraints...');

        // ✅ KIỂM TRA SẢN PHẨM THUỘC VỀ SUBCATEGORY
        const allProducts = await this.productRepository.find({});
        
        const productsInSubcategory = allProducts.filter(product => {
          const productSubcategoryId = product.subcategoryId;
          return (
            productSubcategoryId?.toString() === objectId.toString() ||
            (productSubcategoryId instanceof MongoObjectId && productSubcategoryId.equals(objectId))
          );
        });

        console.log(`🔍 Total products in subcategory: ${productsInSubcategory.length}`);

        if (productsInSubcategory.length > 0) {
          // ✅ KIỂM TRA SẢN PHẨM ĐANG HOẠT ĐỘNG
          const activeProducts = productsInSubcategory.filter(p => {
            if (typeof p.isActive === 'string') {
              return p.isActive === 'true';
            }
            return p.isActive === true;
          });
          
          console.log(`🔍 Active products: ${activeProducts.length}`);

          if (activeProducts.length > 0) {
            throw new BadRequestException(
              `❌ Không thể vô hiệu hóa danh mục con "${existingSubcategory.name}" vì còn ${activeProducts.length} sản phẩm đang hoạt động.\n\n` +
              `Vui lòng vô hiệu hóa hoặc chuyển tất cả sản phẩm sang danh mục khác trước.`
            );
          }

          console.log(`✅ No active products, but ${productsInSubcategory.length} inactive products exist`);
        }
      }

      // ===== BƯỚC 4: CẬP NHẬT TRẠNG THÁI =====
      await this.subcategoryRepository.update(
        { _id: objectId },
        { 
          isActive: newStatus,
          updatedAt: new Date()
        }
      );

      // ===== BƯỚC 5: TRẢ VỀ SUBCATEGORY ĐÃ CẬP NHẬT =====
      const updatedSubcategory = await this.subcategoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!updatedSubcategory) {
        throw new BadRequestException(`Không thể lấy danh mục con đã cập nhật với ID: ${id}`);
      }

      console.log(`✅ Subcategory status toggled: ${existingSubcategory.name} → ${newStatus ? 'ACTIVE' : 'INACTIVE'}`);
      
      return updatedSubcategory;

    } catch (error) {
      console.error('❌ Error toggling subcategory status:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi thay đổi trạng thái danh mục con: ${error.message}`);
    }
  }

  // ✅ HARD DELETE - XÓA VĨNH VIỄN KHỎI DATABASE
  async remove(id: string): Promise<{ message: string; deletedSubcategory: { id: string; name: string } }> {
    try {
      console.log(`🗑️ Hard deleting subcategory: ID=${id}`);
      
      if (!MongoObjectId.isValid(id)) {
        throw new BadRequestException(`ID danh mục con không hợp lệ: ${id}`);
      }

      const objectId = new MongoObjectId(id);
      
      // ===== BƯỚC 1: TÌM SUBCATEGORY =====
      const existingSubcategory = await this.subcategoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingSubcategory) {
        throw new BadRequestException(`Không tìm thấy danh mục con với ID: ${id}`);
      }

      console.log(`Found subcategory: "${existingSubcategory.name}"`);

      // ===== BƯỚC 2: KIỂM TRA SẢN PHẨM (BẤT KỂ TRẠNG THÁI) =====
      const allProducts = await this.productRepository.find({});
      
      const productsInSubcategory = allProducts.filter(product => {
        const productSubcategoryId = product.subcategoryId;
        return (
          productSubcategoryId?.toString() === objectId.toString() ||
          (productSubcategoryId instanceof MongoObjectId && productSubcategoryId.equals(objectId))
        );
      });

      console.log(`🔍 Products in subcategory: ${productsInSubcategory.length}`);

      if (productsInSubcategory.length > 0) {
        throw new BadRequestException(
          `❌ Không thể xóa danh mục con "${existingSubcategory.name}" vì còn ${productsInSubcategory.length} sản phẩm.\n\n` +
          `Vui lòng xóa hoặc chuyển tất cả sản phẩm sang danh mục khác trước.`
        );
      }

      console.log(`✅ No products found`);

      // ===== BƯỚC 3: XÓA VĨNH VIỄN KHỎI DATABASE =====
      await this.subcategoryRepository.delete({ _id: objectId });

      console.log(`✅ Subcategory permanently deleted: "${existingSubcategory.name}"`);

      // ===== BƯỚC 4: TRẢ VỀ THÔNG BÁO =====
      return {
        message: `Đã xóa vĩnh viễn danh mục con "${existingSubcategory.name}" khỏi hệ thống`,
        deletedSubcategory: {
          id: id,
          name: existingSubcategory.name
        }
      };

    } catch (error) {
      console.error('❌ Error hard deleting subcategory:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi xóa danh mục con: ${error.message}`);
    }
  }

  // Lấy tất cả sản phẩm thuộc về một subcategory
  async getProductsBySubcategory(subcategoryId: string): Promise<Product[]> {
    if (!MongoObjectId.isValid(subcategoryId)) {
      throw new BadRequestException(`ID danh mục con không hợp lệ: ${subcategoryId}`);
    }
    const objectId = new MongoObjectId(subcategoryId);
    // Chỉ lấy sản phẩm đang hoạt động (isActive: true)
    return this.productRepository.find({
      where: { subcategoryId: objectId, isActive: true }
    });
  }


}

