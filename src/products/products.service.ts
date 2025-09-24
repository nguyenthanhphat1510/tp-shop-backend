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
  async create(
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

        console.log(`🔄 Đang tạo variant ${i + 1}/${createProductDto.variants.length}:`, {
          storage: variantDto.storage,
          color: variantDto.color,
          price: variantDto.price,
          stock: variantDto.stock
        });

        // 🏷️ TẠO SKU (STOCK KEEPING UNIT) - MÃ ĐỊNH DANH DUY NHẤT
        /*
         * SKU Format: "PRODUCTNAME-STORAGE-COLOR"
         * Ví dụ: 
         * - "IPHONE16-128GB-ĐEN"
         * - "SAMSUNGGALAXYS24-256GB-TRẮNG"
         * - "XIAOMI13PRO-512GB-XÁNHDƯƠNG"
         */
        const sku = `${createProductDto.name.toUpperCase().replace(/\s+/g, '')}-${variantDto.storage}-${variantDto.color.toUpperCase().replace(/\s+/g, '')}`;

        console.log(`🏷️ Generated SKU: ${sku}`);

        // Kiểm tra SKU đã tồn tại chưa (SKU phải unique)
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
        where: { isActive: true },
        order: { createdAt: 'DESC' }
      });

      const result: Product[] = [];

      for (const product of products) {
        const variants = await this.variantsRepository.find({
          where: { productId: product._id, isActive: true },
          order: { price: 'ASC' } // ✅ Sắp xếp theo giá tăng dần
        });

        if (variants.length > 0) {
          // ✅ FLAT STRUCTURE - Merge product + variants info
          const productWithVariants = {
            ...product,
            variants: variants.map(v => ({
              _id: v._id,
              storage: v.storage,
              color: v.color,
              price: v.price,
              stock: v.stock,
              images: v.imageUrls, // ✅ Rename imageUrls thành images
              isActive: v.isActive
            }))
          };

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
  // ✅ Toggle status product và tất cả variants
  async toggleStatus(id: string): Promise<{ product: Product; variants: ProductVariant[] }> {
    try {
      console.log(`🔄 Toggling product status: ID=${id}`);

      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);

      const existingProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingProduct) {
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      const newStatus = !existingProduct.isActive;

      // Cập nhật product và tất cả variants
      await Promise.all([
        this.productsRepository.update(
          { _id: objectId },
          { isActive: newStatus, updatedAt: new Date() }
        ),
        this.variantsRepository.update(
          { productId: objectId },
          { isActive: newStatus, updatedAt: new Date() }
        )
      ]);

      // Lấy dữ liệu đã cập nhật
      const [updatedProduct, updatedVariants] = await Promise.all([
        this.productsRepository.findOne({ where: { _id: objectId } }),
        this.variantsRepository.find({ where: { productId: objectId } })
      ]);

      console.log(`✅ Product "${existingProduct.name}" status: ${newStatus ? 'active' : 'inactive'}`);
      return { product: updatedProduct!, variants: updatedVariants };

    } catch (error) {
      console.error('❌ Error toggling product status:', error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi thay đổi trạng thái sản phẩm: ${error.message}`);
    }
  }

  // ✅ Soft delete
  async softDelete(id: string): Promise<{ product: Product; variants: ProductVariant[] }> {
    try {
      console.log(`🗑️ Soft deleting product: ID=${id}`);

      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const objectId = new ObjectId(id);

      const existingProduct = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      if (!existingProduct) {
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      // Set product và tất cả variants thành inactive
      await Promise.all([
        this.productsRepository.update(
          { _id: objectId },
          { isActive: false, updatedAt: new Date() }
        ),
        this.variantsRepository.update(
          { productId: objectId },
          { isActive: false, updatedAt: new Date() }
        )
      ]);

      const [updatedProduct, updatedVariants] = await Promise.all([
        this.productsRepository.findOne({ where: { _id: objectId } }),
        this.variantsRepository.find({ where: { productId: objectId } })
      ]);

      console.log(`✅ Product "${existingProduct.name}" soft deleted`);
      return { product: updatedProduct!, variants: updatedVariants };

    } catch (error) {
      console.error('❌ Error soft deleting product:', error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi xóa sản phẩm: ${error.message}`);
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
   * Cho phép:
   * - Sửa thông tin sản phẩm (tên, mô tả, category)
   * - Thêm variants mới
   * - Cập nhật variants hiện có
   * - Xóa variants cũ
   * - Upload ảnh mới cho variants
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    files?: { [fieldname: string]: Express.Multer.File[] }
  ): Promise<{ product: Product; variants: ProductVariant[] }> {
    try {
      console.log('🔄 Updating product:', id, updateProductDto);

      // Validate product ID
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      const productObjectId = new ObjectId(id);

      // Tìm sản phẩm hiện tại
      const existingProduct = await this.productsRepository.findOne({
        where: { _id: productObjectId }
      });

      if (!existingProduct) {
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      // 📍 BƯỚC 1: CẬP NHẬT THÔNG TIN SẢN PHẨM CHÍNH
      const updateData: Partial<Product> = {
        updatedAt: new Date()
      };

      if (updateProductDto.name) {
        // Kiểm tra tên mới có bị trùng không (trừ chính nó)
        const duplicateName = await this.productsRepository.findOne({
          where: { 
            name: updateProductDto.name,
            _id: { $ne: productObjectId } // Exclude current product
          }
        });

        if (duplicateName) {
          throw new BadRequestException(`Tên sản phẩm "${updateProductDto.name}" đã được sử dụng`);
        }

        updateData.name = updateProductDto.name;
      }

      if (updateProductDto.description) {
        updateData.description = updateProductDto.description;
      }

      // Validate và cập nhật category nếu có
      if (updateProductDto.categoryId) {
        const categoryId = new ObjectId(updateProductDto.categoryId);
        const category = await this.categoryRepository.findOne({
          where: { _id: categoryId }
        });

        if (!category) {
          throw new NotFoundException(`Không tìm thấy danh mục với ID: ${updateProductDto.categoryId}`);
        }

        updateData.categoryId = categoryId;
      }

      // Validate và cập nhật subcategory nếu có
      if (updateProductDto.subcategoryId) {
        const subcategoryId = new ObjectId(updateProductDto.subcategoryId);
        const subcategory = await this.subcategoryRepository.findOne({
          where: { _id: subcategoryId }
        });

        if (!subcategory) {
          throw new NotFoundException(`Không tìm thấy danh mục con với ID: ${updateProductDto.subcategoryId}`);
        }

        updateData.subcategoryId = subcategoryId;
      }

      // Cập nhật sản phẩm chính
      await this.productsRepository.update({ _id: productObjectId }, updateData);
      console.log('✅ Updated product basic info');

      // 📍 BƯỚC 2: XỬ LÝ VARIANTS
      let updatedVariants: ProductVariant[] = [];

      if (updateProductDto.variants && updateProductDto.variants.length > 0) {
        console.log(`🔄 Processing ${updateProductDto.variants.length} variants`);

        // Lấy tất cả variants hiện tại
        const existingVariants = await this.variantsRepository.find({
          where: { productId: productObjectId }
        });

        // Xử lý từng variant trong request
        for (let i = 0; i < updateProductDto.variants.length; i++) {
          const variantDto = updateProductDto.variants[i];
          
          if (variantDto._id) {
            // 🔄 CẬP NHẬT VARIANT HIỆN CÓ
            console.log(`🔄 Updating existing variant: ${variantDto._id}`);
            
            const variantObjectId = new ObjectId(variantDto._id);
            const existingVariant = await this.variantsRepository.findOne({
              where: { _id: variantObjectId, productId: productObjectId }
            });

            if (!existingVariant) {
              throw new NotFoundException(`Không tìm thấy variant với ID: ${variantDto._id}`);
            }

            // Cập nhật thông tin variant
            const variantUpdateData: Partial<ProductVariant> = {
              storage: variantDto.storage,
              color: variantDto.color,
              price: variantDto.price,
              stock: variantDto.stock,
              isActive: variantDto.isActive ?? existingVariant.isActive,
              updatedAt: new Date()
            };

            // Upload ảnh mới nếu có
            const variantFiles = files?.[`variant_${i}_images`];
            if (variantFiles && variantFiles.length > 0) {
              console.log(`📸 Uploading new images for variant ${variantDto.color}`);

              // Xóa ảnh cũ trên Cloudinary
              if (existingVariant.imagePublicIds && existingVariant.imagePublicIds.length > 0) {
                await Promise.all(
                  existingVariant.imagePublicIds.map(publicId => 
                    this.cloudinaryService.deleteImage(publicId)
                  )
                );
              }

              // Upload ảnh mới
              const newImageUrls: string[] = [];
              const newPublicIds: string[] = [];

              for (const file of variantFiles) {
                const uploadResult = await this.cloudinaryService.uploadImage(
                  file,
                  `tpshop/products/${productObjectId}/variants/${variantDto.color}`
                );
                newImageUrls.push(uploadResult.secure_url);
                newPublicIds.push(uploadResult.public_id);
              }

              variantUpdateData.imageUrls = newImageUrls;
              variantUpdateData.imagePublicIds = newPublicIds;
            }

            // Lưu cập nhật
            await this.variantsRepository.update({ _id: variantObjectId }, variantUpdateData);
            
            const updatedVariant = await this.variantsRepository.findOne({
              where: { _id: variantObjectId }
            });
            
            if (updatedVariant) {
              updatedVariants.push(updatedVariant);
            }

          } else {
            // 🆕 TẠO VARIANT MỚI
            console.log(`🆕 Creating new variant: ${variantDto.color} - ${variantDto.storage}`);

            // Tạo SKU cho variant mới
            const productName = updateData.name || existingProduct.name;
            const sku = `${productName.toUpperCase().replace(/\s+/g, '')}-${variantDto.storage}-${(variantDto.color || '').toUpperCase().replace(/\s+/g, '')}`;

            // Kiểm tra SKU trùng
            const existingSku = await this.variantsRepository.findOne({
              where: { sku }
            });

            if (existingSku) {
              throw new BadRequestException(`SKU "${sku}" đã tồn tại`);
            }

            // Upload ảnh cho variant mới
            let newImageUrls: string[] = [];
            let newPublicIds: string[] = [];

            const variantFiles = files?.[`variant_${i}_images`];
            if (variantFiles && variantFiles.length > 0) {
              console.log(`📸 Uploading images for new variant ${variantDto.color}`);

              for (const file of variantFiles) {
                const uploadResult = await this.cloudinaryService.uploadImage(
                  file,
                  `tpshop/products/${productObjectId}/variants/${variantDto.color}`
                );
                newImageUrls.push(uploadResult.secure_url);
                newPublicIds.push(uploadResult.public_id);
              }
            }

            // Tạo variant mới
            const newVariantData = {
              productId: productObjectId,
              sku,
              storage: variantDto.storage,
              color: variantDto.color,
              price: variantDto.price,
              stock: variantDto.stock,
              imageUrls: newImageUrls,
              imagePublicIds: newPublicIds,
              isActive: variantDto.isActive ?? true,
              sold: 0
            };

            const newVariant = this.variantsRepository.create(newVariantData);
            const savedVariant = await this.variantsRepository.save(newVariant);
            updatedVariants.push(savedVariant);
          }
        }

        // 📍 BƯỚC 3: XÓA VARIANTS KHÔNG CÒN TRONG REQUEST
        const variantIdsInRequest = updateProductDto.variants
          .filter(v => v._id)
          .map(v => v._id);

        const variantsToDelete = existingVariants.filter(
          existing => !variantIdsInRequest.includes(existing._id.toString())
        );

        if (variantsToDelete.length > 0) {
          console.log(`🗑️ Deleting ${variantsToDelete.length} removed variants`);

          for (const variantToDelete of variantsToDelete) {
            // Xóa ảnh trên Cloudinary
            if (variantToDelete.imagePublicIds && variantToDelete.imagePublicIds.length > 0) {
              await Promise.all(
                variantToDelete.imagePublicIds.map(publicId => 
                  this.cloudinaryService.deleteImage(publicId)
                )
              );
            }

            // Xóa variant khỏi database
            await this.variantsRepository.delete({ _id: variantToDelete._id });
          }
        }
      } else {
        // Nếu không có variants trong request, lấy variants hiện có
        updatedVariants = await this.variantsRepository.find({
          where: { productId: productObjectId }
        });
      }

      // Lấy thông tin sản phẩm đã cập nhật
      const updatedProduct = await this.productsRepository.findOne({
        where: { _id: productObjectId }
      });

      console.log(`✅ Updated product "${updatedProduct!.name}" with ${updatedVariants.length} variants`);

      return {
        product: updatedProduct!,
        variants: updatedVariants
      };

    } catch (error) {
      console.error('❌ Error updating product:', error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi cập nhật sản phẩm: ${error.message}`);
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
}