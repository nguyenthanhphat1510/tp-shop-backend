import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { CreateProductWithVariantsDto } from './dto/create-product-with-variants.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from '../category/entities/category.entity';
import { Subcategory } from '../subcategory/entities/subcategory.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { GeminiService } from '../gemini/gemini.service'; // ✅ THÊM

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: MongoRepository<Product>,
    @InjectRepository(ProductVariant)
    private variantsRepository: MongoRepository<ProductVariant>,
    @InjectRepository(Category)
    private categoryRepository: MongoRepository<Category>,
    @InjectRepository(Subcategory)
    private subcategoryRepository: MongoRepository<Subcategory>,
    private cloudinaryService: CloudinaryService,
    private geminiService: GeminiService, // ✅ THÊM
  ) { }

  /**
   * 🆕 TẠO SẢN PHẨM VỚI VARIANTS
   * 
   * Hàm này tạo một sản phẩm mới với nhiều biến thể (variants).
   * Mỗi variant có dung lượng, màu sắc, giá và ảnh riêng biệt.
   * 
   * @param createProductDto - Dữ liệu sản phẩm và variants
   * @param files - File ảnh cho từng variant (optional)
   * @returns Promise<{ product: Product; variants: ProductVariant[] }>
   */
  async createWithVariants(
    createProductDto: CreateProductWithVariantsDto,
    files?: { [fieldname: string]: Express.Multer.File[] }
  ): Promise<{ product: Product; variants: ProductVariant[] }> {
    try {
      console.log('🆕 Bắt đầu tạo sản phẩm với variants:', createProductDto);

      // 📍 BƯỚC 1: VALIDATE CATEGORY VÀ SUBCATEGORY
      // Chuyển đổi string ID thành ObjectId để query MongoDB
      const categoryObjectId = new ObjectId(createProductDto.categoryId);
      const subcategoryObjectId = new ObjectId(createProductDto.subcategoryId);

      // Kiểm tra đồng thời category và subcategory có tồn tại không
      const [category, subcategory] = await Promise.all([
        this.categoryRepository.findOne({ where: { _id: categoryObjectId } }),
        this.subcategoryRepository.findOne({ where: { _id: subcategoryObjectId } })
      ]);

      // Ném lỗi nếu không tìm thấy category
      if (!category) {
        throw new NotFoundException(`❌ Không tìm thấy danh mục với ID ${createProductDto.categoryId}`);
      }

      // Ném lỗi nếu không tìm thấy subcategory
      if (!subcategory) {
        throw new NotFoundException(`❌ Không tìm thấy danh mục con với ID ${createProductDto.subcategoryId}`);
      }

      // Kiểm tra subcategory có thuộc về category đã chọn không
      if (subcategory.categoryId.toString() !== categoryObjectId.toString()) {
        throw new BadRequestException('❌ Danh mục con không thuộc danh mục đã chọn');
      }

      console.log('✅ Category và Subcategory hợp lệ');

      // 📍 BƯỚC 2: KIỂM TRA TÊN SẢN PHẨM ĐÃ TỒN TẠI
      // Tìm sản phẩm có tên trùng trong database
      const existingProduct = await this.productsRepository.findOne({
        where: { name: createProductDto.name }
      });

      // Ném lỗi nếu tên đã được sử dụng
      if (existingProduct) {
        throw new BadRequestException(`❌ Sản phẩm với tên "${createProductDto.name}" đã tồn tại`);
      }

      console.log('✅ Tên sản phẩm chưa được sử dụng');

      // 📍 BƯỚC 3: TẠO SẢN PHẨM CHÍNH (CHỈ THÔNG TIN CƠ BẢN)
      /*
       * Sản phẩm chính chỉ chứa thông tin mô tả, không có:
       * - Giá cụ thể (price) - vì mỗi variant có giá khác nhau
       * - Số lượng (stock) - vì mỗi variant có stock riêng
       * - Ảnh (imageUrls) - vì mỗi variant có ảnh theo màu sắc
       */
      const productData = {
        name: createProductDto.name,           // Tên sản phẩm: "iPhone 16"
        description: createProductDto.description, // Mô tả chi tiết
        categoryId: categoryObjectId,         // ID danh mục cha
        subcategoryId: subcategoryObjectId,   // ID danh mục con
        isActive: true                        // Trạng thái hoạt động
        // ❌ KHÔNG có: price, stock, imageUrls, brand
      };

      // Tạo instance và lưu vào database
      const newProduct = this.productsRepository.create(productData);

      // ❌ COMMENT PHẦN TẠO VECTOR (VÌ QUOTA GEMINI HẾT)
      // console.log('🧠 Đang tạo vector cho sản phẩm...');
      // Tạo text để search
      // newProduct.searchText = newProduct.createSearchText();
      // console.log(`📝 Text để tạo vector: "${newProduct.searchText}"`);

      // Tạo vector từ text
      // newProduct.embedding = await this.geminiService.createEmbedding(newProduct.searchText);
      // console.log(`✅ Tạo được vector có ${newProduct.embedding.length} chiều`);

      const savedProduct = await this.productsRepository.save(newProduct);

      console.log(`✅ Đã tạo sản phẩm chính: "${savedProduct.name}" với ID: ${savedProduct._id}`);

      // 📍 BƯỚC 4: TẠO TẤT CẢ VARIANTS
      /*
       * Mỗi variant đại diện cho một phiên bản cụ thể của sản phẩm:
       * - iPhone 16 128GB Đen: giá 22 triệu, stock 50
       * - iPhone 16 256GB Trắng: giá 25 triệu, stock 30
       * - iPhone 16 512GB Xanh: giá 28 triệu, stock 20
       */

      const createdVariants: ProductVariant[] = [];

      // Duyệt qua từng variant trong danh sách
      for (let i = 0; i < createProductDto.variants.length; i++) {
        const variantDto = createProductDto.variants[i];

        console.log(`🔄 Đang tạo variant ${i + 1}/${createProductDto.variants.length}:`, variantDto);

        // ✅ VALIDATE VARIANT DATA TRƯỚC KHI TẠO SKU
        if (!variantDto) {
          throw new BadRequestException(`❌ Variant ${i} is undefined`);
        }

        if (!variantDto.storage) {
          throw new BadRequestException(`❌ Variant ${i}: storage is required`);
        }

        if (!variantDto.color) {
          throw new BadRequestException(`❌ Variant ${i}: color is required`);
        }

        if (!variantDto.price || variantDto.price <= 0) {
          throw new BadRequestException(`❌ Variant ${i}: price must be greater than 0`);
        }

        if (variantDto.stock === undefined || variantDto.stock < 0) {
          throw new BadRequestException(`❌ Variant ${i}: stock must be 0 or greater`);
        }

        console.log(`✅ Variant ${i} validation passed:`, {
          storage: variantDto.storage,
          color: variantDto.color,
          price: variantDto.price,
          stock: variantDto.stock
        });

        // ✅ SAFE SKU GENERATION
        try {
          const productNameSafe = createProductDto.name.toString().trim().toUpperCase().replace(/\s+/g, '');
          const storageSafe = variantDto.storage.toString().trim().toUpperCase().replace(/\s+/g, '');
          const colorSafe = variantDto.color.toString().trim().toUpperCase().replace(/\s+/g, '');

          const sku = `${productNameSafe}-${storageSafe}-${colorSafe}`;

          console.log(`🏷️ Generated SKU: ${sku}`);

          // Kiểm tra SKU đã tồn tại chưa
          const existingSku = await this.variantsRepository.findOne({
            where: { sku }
          });

          if (existingSku) {
            throw new BadRequestException(`❌ SKU "${sku}" đã tồn tại. Variant này đã được tạo trước đó.`);
          }

          // 📸 UPLOAD ẢNH CHO VARIANT NẦY
          /*
           * Files structure từ frontend:
           * {
           *   'variant_0_images': [file1, file2], // Ảnh cho variant đầu tiên
           *   'variant_1_images': [file3, file4], // Ảnh cho variant thứ hai
           *   'variant_2_images': [file5, file6]  // Ảnh cho variant thứ ba
           * }
           */
          let variantImageUrls: string[] = [];
          let variantImagePublicIds: string[] = [];

          // Lấy files cho variant thứ i
          const variantFiles = files?.[`variant_${i}_images`];

          if (variantFiles && variantFiles.length > 0) {
            console.log(`📸 Đang upload ${variantFiles.length} ảnh cho variant ${variantDto.color}`);

            // Upload từng file lên Cloudinary
            for (const file of variantFiles) {
              const uploadResult = await this.cloudinaryService.uploadImage(
                file,
                `tpshop/products/${savedProduct._id}/variants/${variantDto.color}` // Folder path
              );
              variantImageUrls.push(uploadResult.secure_url);     // URL để hiển thị
              variantImagePublicIds.push(uploadResult.public_id); // ID để xóa sau này
            }

            console.log(`✅ Đã upload thành công ${variantImageUrls.length} ảnh`);
          } else {
            console.log(`ℹ️ Không có ảnh nào được upload cho variant ${variantDto.color}`);
          }

          // 💾 TẠO VÀ LUU VARIANT VÀO DATABASE
          const variantData = {
            productId: savedProduct._id,              // Link tới sản phẩm chính
            sku,                                      // Mã SKU unique
            storage: variantDto.storage,              // Dung lượng: "128GB"
            color: variantDto.color,                  // Màu sắc: "Đen"
            price: variantDto.price,                  // Giá: 22000000
            stock: variantDto.stock,                  // Số lượng tồn: 50
            imageUrls: variantImageUrls,              // Danh sách URL ảnh
            imagePublicIds: variantImagePublicIds,    // Danh sách Public ID
            isActive: variantDto.isActive ?? true,    // Trạng thái (mặc định true)
            sold: 0                                   // Số lượng đã bán (mặc định 0)
          };

          const newVariant = this.variantsRepository.create(variantData);
          const savedVariant = await this.variantsRepository.save(newVariant);
          createdVariants.push(savedVariant);

          console.log(`✅ Đã tạo variant: ${savedVariant.sku} với ${savedVariant.imageUrls.length} ảnh`);
        } catch (error) {
          console.error(`❌ Error creating SKU for variant ${i}:`, error);
          throw new BadRequestException(`❌ Lỗi tạo SKU cho variant ${i}: ${error.message}`);
        }
      }

      // 📊 THỐNG KÊ KẾT QUẢ
      const totalVariants = createdVariants.length;
      const totalStock = createdVariants.reduce((sum, variant) => sum + variant.stock, 0);
      const priceRange = {
        min: Math.min(...createdVariants.map(v => v.price)),
        max: Math.max(...createdVariants.map(v => v.price))
      };

      console.log(`🎉 HOÀN THÀNH! Sản phẩm "${savedProduct.name}" đã được tạo với:`);
      console.log(`   📱 ${totalVariants} variants`);
      console.log(`   📦 ${totalStock} sản phẩm tổng cộng`);
      console.log(`   💰 Giá từ ${priceRange.min.toLocaleString()}đ đến ${priceRange.max.toLocaleString()}đ`);

      // Trả về kết quả
      return {
        product: savedProduct,
        variants: createdVariants
      };

    } catch (error) {
      console.error('❌ LỖI KHI TẠO SẢN PHẨM:', error);

      // Giữ nguyên lỗi validation và not found
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      // Wrap các lỗi khác
      throw new BadRequestException(`❌ Lỗi tạo sản phẩm: ${error.message}`);
    }
  }

  // ✅ Lấy tất cả sản phẩm với variants
  // Cập nhật method findAll() để trả về structure phù hợp:

  async findAll(): Promise<Product[]> {
    try {
      console.log('📋 Finding all products with variants');

      const products = await this.productsRepository.find({
        order: { createdAt: 'DESC' }
      });

      const result: Product[] = [];

      for (const product of products) {
        const variants = await this.variantsRepository.find({
          where: { productId: product._id },
          order: { price: 'ASC' } // ✅ Sắp xếp theo giá tăng dần
        });

        if (variants.length > 0) {
          const productWithVariants: Product = {
            ...product,
            variants: variants.map(v => ({
              _id: v._id,
              storage: v.storage,
              color: v.color,
              price: v.price,
              stock: v.stock,
              images: v.imageUrls,
              isActive: v.isActive // ✅ Dùng isActive thay vì active
            }))
          } as any;

          result.push(productWithVariants);
        }
      }

      console.log(`✅ Found ${result.length} products with variants`);
      return result;

    } catch (error) {
      console.error('❌ Error finding products:', error);
      throw new BadRequestException(`Lỗi lấy danh sách sản phẩm: ${error.message}`);
    }
  }
// ✅ TOGGLE STATUS - CHỈ THAY ĐỔI 1 VARIANT DUY NHẤT
async toggleVariantStatus(variantId: string): Promise<ProductVariant> {
  try {
    console.log(`🔄 Toggling status for variant: ID=${variantId}`);

    if (!ObjectId.isValid(variantId)) {
      throw new BadRequestException(`ID variant không hợp lệ: ${variantId}`);
    }

    const objectId = new ObjectId(variantId);

    // Lấy variant
    const variant = await this.variantsRepository.findOne({
      where: { _id: objectId }
    });

    if (!variant) {
      throw new NotFoundException(`Không tìm thấy variant với ID: ${variantId}`);
    }

    // Toggle trạng thái
    const newStatus = !variant.isActive;
    variant.isActive = newStatus;
    variant.updatedAt = new Date();

    // Lưu lại
    const updatedVariant = await this.variantsRepository.save(variant);

    console.log(`✅ Variant "${variant.sku}" toggled to: ${newStatus ? 'Active' : 'Inactive'}`);

    return updatedVariant;

  } catch (error) {
    console.error('❌ Error toggling variant status:', error);

    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }

    throw new BadRequestException(`Lỗi chuyển đổi trạng thái variant: ${error.message}`);
  }
}

  // ✅ HARD DELETE - GIỮ NGUYÊN
  async hardDelete(id: string): Promise<{
    message: string;
    deletedProduct: string;
    deletedVariantsCount: number;
    deletedImagesCount: number;
  }> {
    try {
      console.log(`🗑️ Hard deleting product permanently: ID=${id}`);

      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);

      // STEP 1: Get product info before deletion
      const existingProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingProduct) {
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      // STEP 2: Get all variants of this product
      const variants = await this.variantsRepository.find({
        where: { productId: objectId }
      });

      console.log(`📦 Found ${variants.length} variants to delete`);

      // STEP 3: Delete all images from Cloudinary
      let deletedImagesCount = 0;
      for (const variant of variants) {
        if (variant.imagePublicIds && variant.imagePublicIds.length > 0) {
          for (const publicId of variant.imagePublicIds) {
            try {
              await this.cloudinaryService.deleteImage(publicId);
              deletedImagesCount++;
              console.log(`🖼️ Deleted image: ${publicId}`);
            } catch (error) {
              console.warn(`⚠️ Failed to delete image ${publicId}:`, error.message);
            }
          }
        }
      }

      console.log(`✅ Deleted ${deletedImagesCount} images from Cloudinary`);

      // STEP 4: Delete all variants from database
      await this.variantsRepository.delete({ productId: objectId });
      console.log(`✅ Deleted ${variants.length} variants from database`);

      // STEP 5: Delete product from database
      await this.productsRepository.delete({ _id: objectId });
      console.log(`✅ Deleted product "${existingProduct.name}" from database`);

      return {
        message: `Đã xóa vĩnh viễn sản phẩm "${existingProduct.name}" và tất cả dữ liệu liên quan`,
        deletedProduct: existingProduct.name,
        deletedVariantsCount: variants.length,
        deletedImagesCount: deletedImagesCount
      };

    } catch (error) {
      console.error('❌ Error hard deleting product:', error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi xóa vĩnh viễn sản phẩm: ${error.message}`);
    }
  }

  // ✅ Tìm theo category
  async findByCategory(categoryId: string): Promise<Array<{ product: Product; variants: ProductVariant[] }>> {
    try {
      if (!ObjectId.isValid(categoryId)) {
        throw new BadRequestException(`ID danh mục không hợp lệ: ${categoryId}`);
      }

      const categoryObjectId = new ObjectId(categoryId);

      const category = await this.categoryRepository.findOne({
        where: { _id: categoryObjectId }
      });

      if (!category) {
        throw new NotFoundException(`Không tìm thấy danh mục với ID: ${categoryId}`);
      }

      const products = await this.productsRepository.find({
        where: { categoryId: categoryObjectId, isActive: true },
        order: { createdAt: 'DESC' }
      });

      const result: Array<{ product: Product; variants: ProductVariant[] }> = [];

      for (const product of products) {
        const variants = await this.variantsRepository.find({
          where: { productId: product._id, isActive: true }
        });
        if (variants.length > 0) { // Chỉ trả về sản phẩm có variants active
          result.push({ product, variants });
        }
      }

      return result;

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi tìm kiếm sản phẩm theo danh mục: ${error.message}`);
    }
  }

  // ✅ Tìm theo khoảng giá
  async findByPriceRange(priceRangeId: string): Promise<Array<{ product: Product; variants: ProductVariant[] }>> {
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

    // Tìm variants trong khoảng giá
    const variants = await this.variantsRepository.find({
      where: {
        price: { $gte: range.min, $lte: range.max },
        isActive: true
      }
    });

    // Lấy danh sách unique productIds
    const productIds = [...new Set(variants.map(v => v.productId.toString()))];

    const result: Array<{ product: Product; variants: ProductVariant[] }> = [];

    for (const productIdStr of productIds) {
      const productId = new ObjectId(productIdStr);
      const product = await this.productsRepository.findOne({
        where: { _id: productId, isActive: true }
      });

      if (product) {
        const productVariants = variants.filter(v => v.productId.toString() === productIdStr);
        result.push({ product, variants: productVariants });
      }
    }

    return result;
  }

  // ✅ Giảm stock cho variant cụ thể (khi đặt hàng)
  async decreaseVariantStock(variantId: string, quantity: number): Promise<void> {
    const variant = await this.variantsRepository.findOne({
      where: { _id: new ObjectId(variantId) }
    });

    if (!variant) {
      throw new BadRequestException('Biến thể sản phẩm không tồn tại');
    }

    if (variant.stock < quantity) {
      throw new BadRequestException(`Không đủ số lượng. Còn lại: ${variant.stock}`);
    }

    variant.stock -= quantity;
    variant.sold += quantity;
    await this.variantsRepository.save(variant);
  }

  // ✅ Lấy thông tin tổng quan sản phẩm (cho dashboard)
  async getProductStats(): Promise<{
    totalProducts: number;
    totalVariants: number;
    totalStock: number;
    totalSold: number;
  }> {
    const [products, variants] = await Promise.all([
      this.productsRepository.find(),
      this.variantsRepository.find()
    ]);

    const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    const totalSold = variants.reduce((sum, variant) => sum + variant.sold, 0);

    return {
      totalProducts: products.length,
      totalVariants: variants.length,
      totalStock,
      totalSold
    };
  }

  /**
   * 🔄 CẬP NHẬT SẢN PHẨM VÀ VARIANTS
   * 
   * Chức năng:
   * 1. Update thông tin product (name, description, category, subcategory)
   * 2. Update các variants HIỆN CÓ (phải có _id)
   * 3. Upload/Update ảnh cho variants
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    files?: { [fieldname: string]: Express.Multer.File[] }
  ): Promise<{ product: Product; variants: ProductVariant[] }> {
    try {
      console.log('🔄 Updating product:', id);

      // ✅ 1. VALIDATE & GET PRODUCT
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException('ID sản phẩm không hợp lệ');
      }

      const productObjectId = new ObjectId(id);
      const existingProduct = await this.productsRepository.findOne({
        where: { _id: productObjectId }
      });

      if (!existingProduct) {
        throw new NotFoundException('Sản phẩm không tồn tại');
      }

      console.log(`✅ Found product: "${existingProduct.name}"`);

      // ✅ 2. UPDATE PRODUCT BASIC INFO
      if (updateProductDto.name) {
        // Check duplicate name
        const duplicateName = await this.productsRepository.findOne({
          where: { 
            name: updateProductDto.name,
            _id: { $ne: productObjectId }
          }
        });

        if (duplicateName) {
          throw new BadRequestException(`Tên sản phẩm "${updateProductDto.name}" đã tồn tại`);
        }

        existingProduct.name = updateProductDto.name;
      }

      if (updateProductDto.description !== undefined) {
        existingProduct.description = updateProductDto.description;
      }

      if (updateProductDto.categoryId) {
        existingProduct.categoryId = new ObjectId(updateProductDto.categoryId);
      }

      if (updateProductDto.subcategoryId) {
        existingProduct.subcategoryId = new ObjectId(updateProductDto.subcategoryId);
      }

      if (updateProductDto.isActive !== undefined) {
        existingProduct.isActive = updateProductDto.isActive;
      }

      existingProduct.updatedAt = new Date();
      await this.productsRepository.save(existingProduct);
      console.log('✅ Product updated');

      // ✅ 3. UPDATE VARIANTS (CHỈ UPDATE, BẮT BUỘC CÓ _id)
      const updatedVariants: ProductVariant[] = [];

      // ✅ FIX: Kiểm tra variants tồn tại và có length > 0
      if (updateProductDto.variants && Array.isArray(updateProductDto.variants) && updateProductDto.variants.length > 0) {
        console.log(`🔄 Updating ${updateProductDto.variants.length} variants`);

        for (let i = 0; i < updateProductDto.variants.length; i++) {
          const variantDto = updateProductDto.variants[i];

          // ❌ BẮT BUỘC PHẢI CÓ _id
          if (!variantDto._id) {
            throw new BadRequestException(`Variant ${i} thiếu _id. Không thể tạo mới variant trong update.`);
          }

          if (!ObjectId.isValid(variantDto._id)) {
            throw new BadRequestException(`Variant ${i} có ID không hợp lệ: ${variantDto._id}`);
          }

          const existingVariant = await this.variantsRepository.findOne({
            where: { _id: new ObjectId(variantDto._id) }
          });

          if (!existingVariant) {
            throw new NotFoundException(`Variant ${i} không tồn tại với ID: ${variantDto._id}`);
          }

          console.log(`🔄 Updating variant: ${existingVariant.sku}`);

          // Update fields
          existingVariant.storage = variantDto.storage;
          existingVariant.color = variantDto.color;
          existingVariant.price = variantDto.price;
          existingVariant.stock = variantDto.stock;

          if (variantDto.isActive !== undefined) {
            existingVariant.isActive = variantDto.isActive;
          }

          // Update SKU nếu storage hoặc color thay đổi
          const newSku = `${existingProduct.name.toUpperCase().replace(/\s+/g, '')}-${variantDto.storage}-${variantDto.color.toUpperCase().replace(/\s+/g, '')}`;
          
          if (newSku !== existingVariant.sku) {
            // Check SKU uniqueness
            const duplicateSku = await this.variantsRepository.findOne({
              where: { 
                sku: newSku,
                _id: { $ne: new ObjectId(variantDto._id) }
              }
            });

            if (duplicateSku) {
              throw new BadRequestException(`SKU "${newSku}" đã tồn tại cho variant khác`);
            }

            existingVariant.sku = newSku;
            console.log(`🏷️ SKU updated: ${existingVariant.sku} → ${newSku}`);
          }

          // ✅ UPDATE IMAGES (NẾU CÓ) - FIX: Kiểm tra variantFiles tồn tại và có length > 0
          const variantFiles = files?.[`variant_${i}_images`];
          if (variantFiles && Array.isArray(variantFiles) && variantFiles.length > 0) {
            console.log(`📸 Updating ${variantFiles.length} images for variant ${existingVariant.color}`);

            // Xóa ảnh cũ trên Cloudinary
            if (existingVariant.imagePublicIds && existingVariant.imagePublicIds.length > 0) {
              for (const publicId of existingVariant.imagePublicIds) {
                try {
                  await this.cloudinaryService.deleteImage(publicId);
                  console.log(`🖼️ Deleted old image: ${publicId}`);
                } catch (error) {
                  console.warn('⚠️ Failed to delete old image');
                }
              }
            }

            // Upload ảnh mới
            const newImageUrls: string[] = [];
            const newImagePublicIds: string[] = [];

            for (const file of variantFiles) {
              const result = await this.cloudinaryService.uploadImage(
                file,
                `tpshop/products/${existingProduct._id}/variants/${variantDto.color}`
              );
              newImageUrls.push(result.secure_url);
              newImagePublicIds.push(result.public_id);
              console.log(`📸 Uploaded new image: ${result.public_id}`);
            }

            existingVariant.imageUrls = newImageUrls;
            existingVariant.imagePublicIds = newImagePublicIds;
          }

          existingVariant.updatedAt = new Date();
          const savedVariant = await this.variantsRepository.save(existingVariant);
          updatedVariants.push(savedVariant);

          console.log(`✅ Updated variant: ${savedVariant.sku}`);
        }
      }

      console.log(`🎉 Update completed with ${updatedVariants.length} variants`);

      return {
        product: existingProduct,
        variants: updatedVariants
      };

    } catch (error) {
      console.error('❌ Error updating product:', error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi cập nhật: ${error.message}`);
    }
  }

  /**
   * 🎯 LẤY SẢN PHẨM THEO ID (CHO FORM EDIT)
   */
  async findOne(id: string): Promise<{ product: Product; variants: ProductVariant[] }> {
    try {
      console.log('🔍 Finding product by ID:', id);

      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const productObjectId = new ObjectId(id);

      // Lấy sản phẩm và variants
      const [product, variants] = await Promise.all([
        this.productsRepository.findOne({ where: { _id: productObjectId } }),
        this.variantsRepository.find({
          where: { productId: productObjectId },
          order: { createdAt: 'ASC' }
        })
      ]);

      if (!product) {
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      console.log(`✅ Found product "${product.name}" with ${variants.length} variants`);

      return { product, variants };

    } catch (error) {
      console.error('❌ Error finding product:', error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi lấy thông tin sản phẩm: ${error.message}`);
    }
  }

  // ✅ Lấy sản phẩm đang sale
  async findProductsOnSale(): Promise<{ product: Product; variants: ProductVariant[] }[]> {
    // Lấy variants đang sale
    const saleVariants = await this.variantsRepository.find({
      where: {
        isOnSale: true,
        isActive: true
      }
    });

    // Group theo productId
    const productIds = [...new Set(saleVariants.map(v => v.productId.toString()))];

    const saleProducts: { product: Product; variants: ProductVariant[] }[] = [];

    for (const productId of productIds) {
      const product = await this.productsRepository.findOne({
        where: { _id: new ObjectId(productId) }
      });

      if (product) {
        const variants = saleVariants.filter(v => v.productId.toString() === productId);
        saleProducts.push({ product, variants });
      }
    }

    return saleProducts;
  }

  // ✅ Áp dụng giảm giá cho variant
  async applyDiscountToVariant(variantId: string, discountPercent: number): Promise<ProductVariant> {
    try {
      console.log(`🎯 Applying ${discountPercent}% discount to variant ${variantId}`);

      // Validate input
      if (!ObjectId.isValid(variantId)) {
        throw new BadRequestException('Variant ID không hợp lệ');
      }

      if (discountPercent < 0 || discountPercent > 100) {
        throw new BadRequestException('Phần trăm giảm giá phải từ 0-100');
      }

      const variant = await this.variantsRepository.findOne({
        where: { _id: new ObjectId(variantId) }
      });

      if (!variant) {
        throw new BadRequestException('Variant không tồn tại');
      }

      // Update discount info
      variant.discountPercent = discountPercent;
      variant.isOnSale = discountPercent > 0;
      variant.updatedAt = new Date();

      const savedVariant = await this.variantsRepository.save(variant);

      console.log(`✅ Applied ${discountPercent}% discount to variant ${variant.sku}`);
      console.log(`   - Original price: ${variant.price.toLocaleString('vi-VN')} VNĐ`);
      console.log(`   - Final price: ${savedVariant.finalPrice.toLocaleString('vi-VN')} VNĐ`);
      console.log(`   - Saved amount: ${savedVariant.savedAmount.toLocaleString('vi-VN')} VNĐ`);

      return savedVariant;

    } catch (error) {
      console.error('❌ Error applying discount to variant:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi áp dụng giảm giá: ${error.message}`);
    }
  }

  // ✅ Bỏ giảm giá cho variant
  async removeDiscountFromVariant(variantId: string): Promise<ProductVariant> {
    try {
      console.log(`🔄 Removing discount from variant ${variantId}`);

      if (!ObjectId.isValid(variantId)) {
        throw new BadRequestException('Variant ID không hợp lệ');
      }

      const variant = await this.variantsRepository.findOne({
        where: { _id: new ObjectId(variantId) }
      });

      if (!variant) {
        throw new BadRequestException('Variant không tồn tại');
      }

      // Reset discount
      variant.discountPercent = 0;
      variant.isOnSale = false;
      variant.updatedAt = new Date();

      const savedVariant = await this.variantsRepository.save(variant);

      console.log(`✅ Removed discount from variant ${variant.sku}`);
      console.log(`   - Price back to: ${variant.price.toLocaleString('vi-VN')} VNĐ`);

      return savedVariant;

    } catch (error) {
      console.error('❌ Error removing discount from variant:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi bỏ giảm giá: ${error.message}`);
    }
  }

  // ✅ Áp dụng giảm giá cho tất cả variants của 1 product
  async applyDiscountToProduct(productId: string, discountPercent: number): Promise<ProductVariant[]> {
    try {
      console.log(`🎯 Applying ${discountPercent}% discount to ALL variants of product ${productId}`);

      // Validate input
      if (!ObjectId.isValid(productId)) {
        throw new BadRequestException('Product ID không hợp lệ');
      }

      if (discountPercent < 0 || discountPercent > 100) {
        throw new BadRequestException('Phần trăm giảm giá phải từ 0-100');
      }

      // Get all variants of the product
      const variants = await this.variantsRepository.find({
        where: { productId: new ObjectId(productId) }
      });

      if (variants.length === 0) {
        throw new BadRequestException('Product không có variant nào');
      }

      console.log(`📦 Found ${variants.length} variants to update`);

      // Update all variants
      const updatedVariants: ProductVariant[] = [];

      for (const variant of variants) {
        variant.discountPercent = discountPercent;
        variant.isOnSale = discountPercent > 0;
        variant.updatedAt = new Date();

        const savedVariant = await this.variantsRepository.save(variant);
        updatedVariants.push(savedVariant);

        console.log(`   ✅ Updated variant ${variant.sku}: ${variant.price.toLocaleString('vi-VN')} → ${savedVariant.finalPrice.toLocaleString('vi-VN')} VNĐ`);
      }

      console.log(`🎉 Applied ${discountPercent}% discount to ${updatedVariants.length} variants`);

      return updatedVariants;

    } catch (error) {
      console.error('❌ Error applying discount to product:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi áp dụng giảm giá cho sản phẩm: ${error.message}`);
    }
  }

  // ✅ Lấy danh sách variants đang sale
  async getVariantsOnSale(): Promise<ProductVariant[]> {
    try {
      console.log('📋 Getting all variants on sale');

      const saleVariants = await this.variantsRepository.find({
        where: {
          isOnSale: true,
          isActive: true
        },
        order: { discountPercent: 'DESC' } // Sắp xếp theo % giảm giá giảm dần
      });

      console.log(`✅ Found ${saleVariants.length} variants on sale`);

      return saleVariants;

    } catch (error) {
      console.error('❌ Error getting sale variants:', error);
      throw new BadRequestException(`Lỗi lấy danh sách variants sale: ${error.message}`);
    }
  }

  // ✅ Lấy thống kê giảm giá
  async getDiscountStats(): Promise<{
    totalVariantsOnSale: number;
    averageDiscountPercent: number;
    totalSavingsAmount: number;
    topDiscountVariants: Array<{
      sku: string;
      productName: string;
      originalPrice: number;
      finalPrice: number;
      discountPercent: number;
      savedAmount: number;
    }>;
  }> {
    try {
      console.log('📊 Getting discount statistics');

      const saleVariants = await this.variantsRepository.find({
        where: {
          isOnSale: true,
          isActive: true
        }
      });

      if (saleVariants.length === 0) {
        return {
          totalVariantsOnSale: 0,
          averageDiscountPercent: 0,
          totalSavingsAmount: 0,
          topDiscountVariants: []
        };
      }

      // Calculate statistics
      const totalVariantsOnSale = saleVariants.length;
      const averageDiscountPercent = saleVariants.reduce((sum, v) => sum + v.discountPercent, 0) / totalVariantsOnSale;
      const totalSavingsAmount = saleVariants.reduce((sum, v) => sum + v.savedAmount, 0);

      // Get top discount variants (top 5)
      const topDiscountVariants = saleVariants
        .sort((a, b) => b.discountPercent - a.discountPercent)
        .slice(0, 5)
        .map(variant => ({
          sku: variant.sku,
          productName: `${variant.storage} - ${variant.color}`, // Temporary, should get product name
          originalPrice: variant.price,
          finalPrice: variant.finalPrice,
          discountPercent: variant.discountPercent,
          savedAmount: variant.savedAmount
        }));

      console.log(`📊 Discount Stats:`, {
        totalVariantsOnSale,
        averageDiscountPercent: Math.round(averageDiscountPercent * 100) / 100,
        totalSavingsAmount: totalSavingsAmount.toLocaleString('vi-VN')
      });

      return {
        totalVariantsOnSale,
        averageDiscountPercent: Math.round(averageDiscountPercent * 100) / 100,
        totalSavingsAmount,
        topDiscountVariants
      };

    } catch (error) {
      console.error('❌ Error getting discount stats:', error);
      throw new BadRequestException(`Lỗi lấy thống kê giảm giá: ${error.message}`);
    }
  }

  /**
   * 🔍 SEMANTIC SEARCH USING VECTOR SIMILARITY
   * ❌ COMMENT VÌ QUOTA GEMINI HẾT
   */
  // async searchByVector(searchQuery: string): Promise<{
  //   products: Array<{
  //     product: Product;
  //     variants: ProductVariant[];
  //     similarity: number;
  //   }>;
  //   searchQuery: string;
  //   totalFound: number;
  // }> {
  //   try {
  //     console.log(`🔍 Searching for: "${searchQuery}"`);

  //     // STEP 1: Create vector for search query
  //     console.log('🧠 Creating embedding for search query...');
  //     const searchVector = await this.geminiService.createEmbedding(searchQuery);
  //     console.log(`✅ Search vector has ${searchVector.length} dimensions`);

  //     // STEP 2: Get all products with embeddings
  //     console.log('📊 Getting all products with embeddings...');
  //     const allProducts = await this.productsRepository.find({
  //       where: {
  //         isActive: true,
  //         embedding: { $exists: true, $ne: [] }
  //       }
  //     });
  //     console.log(`📦 Found ${allProducts.length} products with embeddings`);

  //     // STEP 3: Calculate similarity for each product
  //     console.log('🔢 Calculating similarities...');
  //     const similarityResults: Array<{
  //       product: Product;
  //       similarity: number;
  //     }> = [];

  //     for (const product of allProducts) {
  //       if (!product.embedding || product.embedding.length === 0) {
  //         console.log(`⚠️ Product "${product.name}" has no embedding, skipping`);
  //         continue;
  //       }

  //       // Calculate similarity
  //       const similarity = this.geminiService.calculateSimilarity(
  //         searchVector,
  //         product.embedding
  //       );

  //       // Only include products with similarity >= 0.3 (30%)
  //       if (similarity >= 0.3) {
  //         similarityResults.push({
  //           product: product,
  //           similarity: similarity
  //         });
  //       }
  //     }

  //     console.log(`🎯 Found ${similarityResults.length} relevant products`);

  //     // STEP 4: Sort by similarity (highest first)
  //     similarityResults.sort((a, b) => b.similarity - a.similarity);

  //     // STEP 5: Take top 10 results
  //     const topResults = similarityResults.slice(0, 10);

  //     // STEP 6: Get variants for each product
  //     const finalResults: Array<{
  //       product: Product;
  //       variants: ProductVariant[];
  //       similarity: number;
  //     }> = [];

  //     for (const item of topResults) {
  //       const variants = await this.variantsRepository.find({
  //         where: { productId: item.product._id, isActive: true },
  //         order: { price: 'ASC' }
  //       });

  //       if (variants.length > 0) {
  //         finalResults.push({
  //           product: item.product,
  //           variants: variants,
  //           similarity: item.similarity
  //         });
  //       }
  //     }

  //     console.log(`✅ Returning ${finalResults.length} products`);

  //     return {
  //       products: finalResults,
  //       searchQuery: searchQuery,
  //       totalFound: finalResults.length
  //     };

  //   } catch (error) {
  //     console.error('❌ Search error:', error);
  //     throw new Error(`Search failed: ${error.message}`);
  //   }
  // }

  // ...existing methods...
}
