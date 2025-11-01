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

  async create(createSubcategoryDto: CreateSubcategoryDto): Promise<Subcategory> {
    try {
      // Validate categoryId
      if (!MongoObjectId.isValid(createSubcategoryDto.categoryId)) {
        throw new BadRequestException(`ID danh mục cha không hợp lệ: ${createSubcategoryDto.categoryId}`);
      }

      const categoryObjectId = new MongoObjectId(createSubcategoryDto.categoryId);
      
      // Check if parent category exists and is active
      const category = await this.categoryRepository.findOne({
        where: { _id: categoryObjectId }
      });

      if (!category) {
        throw new BadRequestException(`Không tìm thấy danh mục cha với ID ${createSubcategoryDto.categoryId}`);
      }

      const isActiveCategory = category.isActive === true || (typeof category.isActive === 'string' && category.isActive === 'true');
      if (!isActiveCategory) {
        throw new BadRequestException(`Danh mục cha "${category.name}" đang không hoạt động. Vui lòng chọn danh mục khác.`);
      }

      // Check for duplicate name
      const existingSubcategory = await this.subcategoryRepository.findOne({
        where: { name: createSubcategoryDto.name }
      });

      if (existingSubcategory) {
        throw new BadRequestException(`Danh mục con với tên "${createSubcategoryDto.name}" đã tồn tại`);
      }

      // ✅ Create new subcategory with isActive default = true
      const newSubcategory = this.subcategoryRepository.create({
        name: createSubcategoryDto.name.trim(),
        categoryId: categoryObjectId,
        isActive: true, // Explicitly set default value
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return this.subcategoryRepository.save(newSubcategory);

    } catch (error) {
      console.error('Error creating subcategory:', error);
      
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

  
  async update(id: string, updateSubcategoryDto: UpdateSubcategoryDto): Promise<Subcategory> {
    try {
      console.log('Updating subcategory with ID:', id);
      console.log('Update data:', updateSubcategoryDto);

      // Kiểm tra ObjectId hợp lệ
      if (!MongoObjectId.isValid(id)) {
        throw new BadRequestException(`ID danh mục con không hợp lệ: ${id}`);
      }

      const objectId = new MongoObjectId(id);
      
      // Tìm subcategory hiện tại
      const existingSubcategory = await this.subcategoryRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingSubcategory) {
        throw new BadRequestException(`Không tìm thấy danh mục con với ID ${id}`);
      }

      // Validate categoryId mới nếu có
      let categoryObjectId: MongoObjectId | undefined;
      if (updateSubcategoryDto.categoryId) {
        if (typeof updateSubcategoryDto.categoryId === 'string') {
          if (!MongoObjectId.isValid(updateSubcategoryDto.categoryId)) {
            throw new BadRequestException(`ID danh mục cha không hợp lệ: ${updateSubcategoryDto.categoryId}`);
          }
          categoryObjectId = new MongoObjectId(updateSubcategoryDto.categoryId);
        } else {
          categoryObjectId = updateSubcategoryDto.categoryId;
        }

        // Kiểm tra category cha có tồn tại không
        const category = await this.categoryRepository.findOne({
          where: { _id: categoryObjectId }
        });

        if (!category) {
          throw new BadRequestException(`Không tìm thấy danh mục cha với ID ${updateSubcategoryDto.categoryId}`);
        }

        // Kiểm tra category cha có đang active không
        const isActiveCategory = category.isActive === true || (typeof category.isActive === 'string' && category.isActive === 'true');
        if (!isActiveCategory) {
          throw new BadRequestException(`Danh mục cha "${category.name}" đang không hoạt động. Vui lòng chọn danh mục khác.`);
        }
      }

      // Kiểm tra tên trùng lặp nếu có thay đổi tên
      if (updateSubcategoryDto.name && updateSubcategoryDto.name !== existingSubcategory.name) {
        const duplicateSubcategory = await this.subcategoryRepository.findOne({
          where: { name: updateSubcategoryDto.name }
        });

        if (duplicateSubcategory && duplicateSubcategory._id.toString() !== id) {
          throw new BadRequestException(`Danh mục con với tên "${updateSubcategoryDto.name}" đã tồn tại`);
        }
      }

      // Chuẩn bị dữ liệu cập nhật
      const updateData: any = {
        updatedAt: new Date()
      };

      if (updateSubcategoryDto.name) {
        updateData.name = updateSubcategoryDto.name.trim();
      }

      if (categoryObjectId) {
        updateData.categoryId = categoryObjectId;
      }

      // Cập nhật subcategory
      await this.subcategoryRepository.update(objectId, updateData);

      // Trả về subcategory đã cập nhật
      return this.findOne(id);

    } catch (error) {
      console.error('Error updating subcategory:', error);
      
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

