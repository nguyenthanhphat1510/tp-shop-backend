import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { Category } from '../category/entities/category.entity';
import { Subcategory } from '../subcategory/entities/subcategory.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: MongoRepository<Product>,
    @InjectRepository(Category)
    private categoryRepository: MongoRepository<Category>,
    @InjectRepository(Subcategory)
    private subcategoryRepository: MongoRepository<Subcategory>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(createProductDto: CreateProductDto, files?: Express.Multer.File[]): Promise<Product> {
    try {
      console.log('Creating product with data:', createProductDto);
      
      // Chuyển đổi categoryId và subcategoryId
      let categoryObjectId: ObjectId;
      let subcategoryObjectId: ObjectId;
      
      if (typeof createProductDto.categoryId === 'string') {
        categoryObjectId = new ObjectId(createProductDto.categoryId);
      } else {
        categoryObjectId = createProductDto.categoryId;
      }

      if (typeof createProductDto.subcategoryId === 'string') {
        subcategoryObjectId = new ObjectId(createProductDto.subcategoryId);
      } else {
        subcategoryObjectId = createProductDto.subcategoryId;
      }

      // Kiểm tra category
      const category = await this.categoryRepository.findOne({
        where: { _id: categoryObjectId }
      });

      if (!category) {
        throw new NotFoundException(`Không tìm thấy danh mục với ID ${createProductDto.categoryId}`);
      }

      // Kiểm tra subcategory
      const subcategory = await this.subcategoryRepository.findOne({
        where: { _id: subcategoryObjectId }
      });

      if (!subcategory) {
        throw new NotFoundException(`Không tìm thấy danh mục con với ID ${createProductDto.subcategoryId}`);
      }

      // Kiểm tra subcategory có thuộc category không
      if (subcategory.categoryId.toString() !== categoryObjectId.toString()) {
        throw new BadRequestException('Danh mục con không thuộc danh mục đã chọn');
      }

      // Kiểm tra tên sản phẩm đã tồn tại
      const existingProduct = await this.productsRepository.findOne({
        where: { name: createProductDto.name }
      });
      
      if (existingProduct) {
        throw new BadRequestException(`Sản phẩm với tên "${createProductDto.name}" đã tồn tại`);
      }

      // Upload nhiều ảnh lên Cloudinary nếu có
      let imageUrls: string[] = [];
      let imagePublicIds: string[] = [];
      
      if (files && files.length > 0) {
        for (const file of files) {
          const uploadResult = await this.cloudinaryService.uploadImage(file, 'tpshop/products');
          imageUrls.push(uploadResult.secure_url);
          imagePublicIds.push(uploadResult.public_id);
        }
      }

      // Tạo sản phẩm mới
      const productData = {
        name: createProductDto.name,
        description: createProductDto.description,
        price: Number(createProductDto.price),
        imageUrls,
        imagePublicIds,
        categoryId: categoryObjectId,
        subcategoryId: subcategoryObjectId,
        stock: createProductDto.stock || 0,
        isActive:
    typeof createProductDto.isActive === 'boolean'
      ? createProductDto.isActive
      : typeof createProductDto.isActive === 'string'
        ? createProductDto.isActive === 'true'
        : true // Mặc định là true nếu không truyền
      };

      const newProduct = this.productsRepository.create(productData);
      const savedProduct = await this.productsRepository.save(newProduct);
      
      console.log('Product created successfully:', savedProduct);
      return savedProduct;

    } catch (error) {
      console.error('Error creating product:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi tạo sản phẩm: ${error.message}`);
    }
  }

  async findAll(): Promise<Product[]> {
    try {
      console.log('📋 Finding all products');
      
      const products = await this.productsRepository.find({
        order: { createdAt: 'DESC' }
      });
      
      console.log(`✅ Found ${products.length} products`);
      return products;
    } catch (error) {
      console.error('❌ Error finding products:', error);
      throw new BadRequestException(`Lỗi lấy danh sách sản phẩm: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Product> {
    try {
      console.log('🔍 Finding product with ID:', id);
      
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);
      
      const product = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!product) {
        console.log('❌ Product not found with ID:', id);
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      console.log('✅ Product found successfully:', product.name);
      return product;

    } catch (error) {
      console.error('❌ Error finding product:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi tìm kiếm sản phẩm: ${error.message}`);
    }
  }

  // ✅ Toggle status (true ↔ false)
  async toggleStatus(id: string): Promise<Product> {
    try {
      console.log(`🔄 Toggling product status: ID=${id}`);
      
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);
      
      // Find current product
      const existingProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingProduct) {
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      // Handle both string and boolean isActive values
      let currentStatus: boolean;
      if (typeof existingProduct.isActive === 'string') {
        currentStatus = existingProduct.isActive === 'true';
      } else {
        currentStatus = Boolean(existingProduct.isActive);
      }

      // Toggle: true → false, false → true
      const newStatus = !currentStatus;

      // Update status
      await this.productsRepository.update(
        { _id: objectId },
        { 
          isActive: newStatus,
          updatedAt: new Date()
        }
      );

      // Get updated product với null check
      const updatedProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!updatedProduct) {
        throw new NotFoundException(`Không thể lấy sản phẩm đã cập nhật với ID: ${id}`);
      }

      console.log(`✅ Product status toggled: ${existingProduct.name} -> ${newStatus ? 'active' : 'inactive'}`);
      return updatedProduct;

    } catch (error) {
      console.error('❌ Error toggling product status:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi thay đổi trạng thái sản phẩm: ${error.message}`);
    }
  }

  // ✅ Soft delete (always set to false)
  async softDelete(id: string): Promise<Product> {
    try {
      console.log(`🗑️ Soft deleting product: ID=${id}`);
      
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);
      
      // Find product
      const existingProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingProduct) {
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      // Always set to false when deleting
      await this.productsRepository.update(
        { _id: objectId },
        { 
          isActive: false,
          updatedAt: new Date()
        }
      );

      // Get updated product với null check
      const updatedProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!updatedProduct) {
        throw new NotFoundException(`Không thể lấy sản phẩm đã cập nhật với ID: ${id}`);
      }

      console.log(`✅ Product soft deleted: ${existingProduct.name}`);
      return updatedProduct;

    } catch (error) {
      console.error('❌ Error soft deleting product:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi xóa sản phẩm: ${error.message}`);
    }
  }

  // ✅ Update product (full update)
  async update(id: string, updateProductDto: CreateProductDto, files?: Express.Multer.File[]): Promise<Product> {
    try {
      console.log(`📝 Updating product with ID: ${id}`);
      console.log('Update data:', updateProductDto);
      
      // Validate ObjectId
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);
      
      // Find existing product
      const existingProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingProduct) {
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      // Check if name already exists (exclude current product)
      if (updateProductDto.name && updateProductDto.name !== existingProduct.name) {
        const productWithSameName = await this.productsRepository.findOne({
          where: { name: updateProductDto.name }
        });
        
        if (productWithSameName && productWithSameName._id.toString() !== id) {
          throw new BadRequestException(`Sản phẩm với tên "${updateProductDto.name}" đã tồn tại`);
        }
      }

      // ✅ Fix: Initialize variables with default values
      let categoryObjectId: ObjectId | undefined;
      let subcategoryObjectId: ObjectId | undefined;

      // Validate categoryId if provided
      if (updateProductDto.categoryId) {
        if (typeof updateProductDto.categoryId === 'string') {
          categoryObjectId = new ObjectId(updateProductDto.categoryId);
        } else {
          categoryObjectId = updateProductDto.categoryId;
        }

        // Check if category exists
        const category = await this.categoryRepository.findOne({
          where: { _id: categoryObjectId }
        });

        if (!category) {
          throw new NotFoundException(`Không tìm thấy danh mục với ID ${updateProductDto.categoryId}`);
        }
      }

      // Validate subcategoryId if provided
      if (updateProductDto.subcategoryId) {
        if (typeof updateProductDto.subcategoryId === 'string') {
          subcategoryObjectId = new ObjectId(updateProductDto.subcategoryId);
        } else {
          subcategoryObjectId = updateProductDto.subcategoryId;
        }

        // Check if subcategory exists
        const subcategory = await this.subcategoryRepository.findOne({
          where: { _id: subcategoryObjectId }
        });

        if (!subcategory) {
          throw new NotFoundException(`Không tìm thấy danh mục con với ID ${updateProductDto.subcategoryId}`);
        }

        // Check if subcategory belongs to category (if both are provided)
        if (categoryObjectId && subcategory.categoryId.toString() !== categoryObjectId.toString()) {
          throw new BadRequestException('Danh mục con không thuộc danh mục đã chọn');
        }
      }

      // Handle image upload if new files are provided
      let newImageUrls: string[] = [];
      let newImagePublicIds: string[] = [];
      
      if (files && files.length > 0) {
        console.log(`📁 Uploading ${files.length} new images`);
        
        // Delete old images from Cloudinary
        if (existingProduct.imagePublicIds && existingProduct.imagePublicIds.length > 0) {
          for (const publicId of existingProduct.imagePublicIds) {
            try {
              await this.cloudinaryService.deleteImage(publicId);
              console.log(`🗑️ Deleted old image: ${publicId}`);
            } catch (error) {
              console.warn(`⚠️ Could not delete old image ${publicId}:`, error);
            }
          }
        }

        // Upload new images
        for (const file of files) {
          const uploadResult = await this.cloudinaryService.uploadImage(file, 'tpshop/products');
          newImageUrls.push(uploadResult.secure_url);
          newImagePublicIds.push(uploadResult.public_id);
        }
      } else {
        // Keep existing images if no new files
        newImageUrls = existingProduct.imageUrls || [];
        newImagePublicIds = existingProduct.imagePublicIds || [];
      }

      // Prepare update data (only update provided fields)
      const updateData: any = {
        updatedAt: new Date()
      };

      if (updateProductDto.name !== undefined) {
        updateData.name = updateProductDto.name;
      }

      if (updateProductDto.description !== undefined) {
        updateData.description = updateProductDto.description;
      }

      if (updateProductDto.price !== undefined) {
        updateData.price = updateProductDto.price;
      }

      if (updateProductDto.stock !== undefined) {
        updateData.stock = updateProductDto.stock;
      }

      if (updateProductDto.isActive !== undefined) {
        updateData.isActive = updateProductDto.isActive;
      }

      // ✅ Fix: Only update if variables are defined
      if (categoryObjectId !== undefined) {
        updateData.categoryId = categoryObjectId;
      }

      if (subcategoryObjectId !== undefined) {
        updateData.subcategoryId = subcategoryObjectId;
      }

      // Always update images (either new or existing)
      updateData.imageUrls = newImageUrls;
      updateData.imagePublicIds = newImagePublicIds;

      // Update product in database
      await this.productsRepository.update(
        { _id: objectId },
        updateData
      );

      // Get updated product
      const updatedProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!updatedProduct) {
        throw new NotFoundException(`Không thể lấy sản phẩm đã cập nhật với ID: ${id}`);
      }

      console.log(`✅ Product updated successfully: ${updatedProduct.name}`);
      return updatedProduct;

    } catch (error) {
      console.error('❌ Error updating product:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi cập nhật sản phẩm: ${error.message}`);
    }
  }

  // ✅ Partial update (PATCH) - chỉ cập nhật một số field
  async partialUpdate(id: string, updateData: Partial<CreateProductDto>): Promise<Product> {
    try {
      console.log(`🔧 Partial updating product with ID: ${id}`);
      console.log('Partial update data:', updateData);
      
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);
      
      // Find existing product
      const existingProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingProduct) {
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      // Prepare update data
      const updateFields: any = {
        updatedAt: new Date()
      };

      // Only update provided fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          updateFields[key] = updateData[key];
        }
      });

      // Update product
      await this.productsRepository.update(
        { _id: objectId },
        updateFields
      );

      // Get updated product
      const updatedProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!updatedProduct) {
        throw new NotFoundException(`Không thể lấy sản phẩm đã cập nhật với ID: ${id}`);
      }

      console.log(`✅ Product partially updated: ${updatedProduct.name}`);
      return updatedProduct;

    } catch (error) {
      console.error('❌ Error partially updating product:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi cập nhật sản phẩm: ${error.message}`);
    }
  }
  // ✅ Tìm sản phẩm theo category ID
 // ✅ Tìm sản phẩm theo category ID
async findByCategory(categoryId: string): Promise<Product[]> {
  try {
    if (!ObjectId.isValid(categoryId)) {
      throw new BadRequestException(`ID danh mục không hợp lệ: ${categoryId}`);
    }

    const categoryObjectId = new ObjectId(categoryId);
    
    // Tìm category
    const category = await this.categoryRepository.findOne({
      where: { _id: categoryObjectId }
    });

    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục với ID: ${categoryId}`);
    }

    // Tìm tất cả products trong category
    const products = await this.productsRepository.find({
      where: {
        categoryId: categoryObjectId
      },
      order: { createdAt: 'DESC' }
    });
    
    return products;
    
  } catch (error) {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }
    
    throw new BadRequestException(`Lỗi tìm kiếm sản phẩm theo danh mục: ${error.message}`);
  }
}

async findByPriceRange(priceRangeId: string): Promise<Product[]> {
  // Định nghĩa các khoảng giá
  const priceRanges: Record<string, { min: number; max: number }> = {
    'under-5m': { min: 0, max: 5000000 },
    '5m-10m': { min: 5000000, max: 10000000 },
    '10m-20m': { min: 10000000, max: 20000000 },
    '20m-30m': { min: 20000000, max: 30000000 },
    'above-30m': { min: 30000000, max: 999999999 }
  };

  const range = priceRanges[priceRangeId];
  if (!range) {
    throw new BadRequestException('Khoảng giá không hợp lệ');
  }

  return this.productsRepository.find({
    where: {
      price: { $gte: range.min, $lte: range.max },
      isActive: true
    },
    order: { createdAt: 'DESC' }
  });
}

async decreaseStock(productId: string, quantity: number): Promise<void> {
  const product = await this.productsRepository.findOne({ where: { _id: new ObjectId(productId) } });
  if (!product) throw new BadRequestException('Sản phẩm không tồn tại');
  if (product.stock < quantity) throw new BadRequestException('Không đủ số lượng sản phẩm trong kho');
  product.stock -= quantity;
  await this.productsRepository.save(product);
}
}