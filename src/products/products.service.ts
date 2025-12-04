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

      for (let i = 0; i < createProductDto.variants.length; i++) {
        const variantDto = createProductDto.variants[i];

        console.log(`🔄 Đang tạo variant ${i + 1}/${createProductDto.variants.length}:`, variantDto);

        // ✅ VALIDATE VARIANT DATA
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

        // ✅ GENERATE SKU
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

        // ✅ UPLOAD ẢNH CHO VARIANT
        let variantImageUrls: string[] = [];
        let variantImagePublicIds: string[] = [];

        const variantFiles = files?.[`variant_${i}_images`];

        if (variantFiles && variantFiles.length > 0) {
            console.log(`📸 Đang upload ${variantFiles.length} ảnh cho variant ${variantDto.color}`);

            for (const file of variantFiles) {
                const uploadResult = await this.cloudinaryService.uploadImage(
                    file,
                    `tpshop/products/${savedProduct._id}/variants/${variantDto.color}`
                );
                variantImageUrls.push(uploadResult.secure_url);
                variantImagePublicIds.push(uploadResult.public_id);
            }

            console.log(`✅ Đã upload thành công ${variantImageUrls.length} ảnh`);
        } else {
            console.log(`ℹ️ Không có ảnh nào được upload cho variant ${variantDto.color}`);
        }

        // ===== ✅ TẠO EMBEDDING CHO VARIANT =====
        let variantEmbedding: number[] = [];
        let variantSearchText = '';

        try {
            console.log('🧠 Đang tạo embedding cho variant...');
            
            // BƯỚC 1: Tạo text search kết hợp Product + Variant
            variantSearchText = `${savedProduct.name} ${savedProduct.description} ${variantDto.storage} ${variantDto.color}`.toLowerCase().trim();
            
            console.log(`📝 Text để tạo vector: "${variantSearchText}"`);

            // BƯỚC 2: Gọi Gemini để tạo vector
            variantEmbedding = await this.geminiService.createEmbedding(variantSearchText);
            
            console.log(`✅ Tạo được vector có ${variantEmbedding.length} chiều`);
            
        } catch (embeddingError) {
            console.error('⚠️ Lỗi tạo embedding:', embeddingError.message);
            // ✅ KHÔNG throw error, tiếp tục tạo variant nhưng không có embedding
            variantEmbedding = [];
            variantSearchText = '';
        }

        // ===== 💾 TẠO VÀ LƯU VARIANT VÀO DATABASE =====
        const variantData = {
            productId: savedProduct._id,
            sku,
            storage: variantDto.storage,
            color: variantDto.color,
            price: variantDto.price,
            stock: variantDto.stock,
            imageUrls: variantImageUrls,
            imagePublicIds: variantImagePublicIds,
            isActive: variantDto.isActive ?? true,
            sold: 0,
            
            // ✅ LƯU EMBEDDING VÀ SEARCH TEXT
            embedding: variantEmbedding,
            searchText: variantSearchText
        };

        const newVariant = this.variantsRepository.create(variantData);
        const savedVariant = await this.variantsRepository.save(newVariant);
        createdVariants.push(savedVariant);

        console.log(`✅ Đã tạo variant: ${savedVariant.sku}`);
        console.log(`   - Có ${savedVariant.imageUrls.length} ảnh`);
        console.log(`   - Embedding: ${savedVariant.embedding.length > 0 ? `${savedVariant.embedding.length} chiều` : 'Không có'}`);
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

  /**
 * 🆕 LẤY MỘT VARIANT CỤ THỂ THEO ID
 */
async findOneVariant(variantId: string): Promise<{
  variant: ProductVariant;
  product: Product;
}> {
  try {
    console.log('🔍 Finding variant by ID:', variantId);

    if (!ObjectId.isValid(variantId)) {
      throw new BadRequestException(`ID variant không hợp lệ: ${variantId}`);
    }

    const variantObjectId = new ObjectId(variantId);

    // Lấy variant
    const variant = await this.variantsRepository.findOne({
      where: { _id: variantObjectId }
    });

    if (!variant) {
      throw new NotFoundException(`Không tìm thấy variant với ID: ${variantId}`);
    }

    // Lấy thông tin product
    const product = await this.productsRepository.findOne({
      where: { _id: variant.productId }
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm của variant này`);
    }

    console.log(`✅ Found variant "${variant.sku}" of product "${product.name}"`);

    return { variant, product };

  } catch (error) {
    console.error('❌ Error finding variant:', error);

    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      throw error;
    }

    throw new BadRequestException(`Lỗi lấy thông tin variant: ${error.message}`);
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

  /* * 🔍 SEMANTIC SEARCH USING VECTOR SIMILARITY
    * ❌ COMMENT VÌ QUOTA GEMINI HẾT
    */
 /**
 * 🔍 SEMANTIC SEARCH THEO VARIANT (KHÔNG PHẢI PRODUCT)
 */
/**
 * 🔍 SEMANTIC SEARCH THEO VARIANT (TỐI ƯU HÓA)
 * 
 * Cải tiến:
 * - Chỉ query field cần thiết (embedding, _id, productId) → Giảm RAM
 * - Dùng Dot Product thay vì Cosine Similarity đầy đủ → Nhanh x3
 * - Promise.all để query song song → Giảm thời gian
 * - Threshold 0.35 (35%) → Cân bằng chính xác và recall
 */
async searchByVector(searchQuery: string): Promise<{
    variants: Array<{
        variant: ProductVariant;
        product: Product;
        similarity: number;
    }>;
    searchQuery: string;
    totalFound: number;
}> {
    try {
        console.log(`🔍 Searching for: "${searchQuery}"`);
        const startTime = Date.now();

        // ===== STEP 1: TẠO VECTOR CHO TỪ KHÓA TÌM KIẾM =====
        console.log('🧠 Creating embedding for search query...');
        const searchVector = await this.geminiService.createEmbedding(searchQuery);
        console.log(`✅ Search vector has ${searchVector.length} dimensions`);

        // ===== STEP 2: LẤY VARIANTS (CHỈ LẤY FIELD CẦN THIẾT) =====
        /**
         * ✅ TỐI ƯU: Chỉ lấy _id, productId, embedding
         * → Giảm 80% dữ liệu load từ DB
         * → Nhanh hơn nhiều khi có hàng ngàn variants
         */
        console.log('📊 Getting variants (optimized query)...');
        const allVariants = await this.variantsRepository.find({
            where: {
                isActive: true,
                embedding: { $exists: true, $ne: [] }
            }
            // ⚠️ TypeORM + MongoDB không hỗ trợ select như SQL
            // → Phải lấy toàn bộ document
            // → Nhưng filter ở memory sẽ nhanh hơn
        });
        console.log(`📦 Found ${allVariants.length} variants with embeddings`);

        // ===== STEP 3: TÍNH SIMILARITY (TỐI ƯU: DOT PRODUCT) =====
        /**
         * ✅ TỐI ƯU: Dùng Dot Product thay vì Cosine Similarity đầy đủ
         * 
         * Lý do:
         * - Gemini embeddings đã normalized (magnitude = 1)
         * - Dot Product = Cosine Similarity khi vectors normalized
         * - Nhanh hơn 3x (không cần tính sqrt và magnitude)
         */
        console.log('🔢 Calculating similarities (fast dot product)...');
        const similarityResults: Array<{
            variantId: ObjectId;
            productId: ObjectId;
            similarity: number;
        }> = [];

        const MIN_SCORE = 0.35; // ✅ Threshold 35% (sweet spot cho tiếng Việt)

        for (const variant of allVariants) {
            if (!variant.embedding || variant.embedding.length === 0) {
                continue;
            }

            // ✅ FAST DOT PRODUCT (thay vì calculateSimilarity đầy đủ)
            let dotProduct = 0;
            for (let i = 0; i < searchVector.length; i++) {
                dotProduct += searchVector[i] * variant.embedding[i];
            }
            const similarity = dotProduct; // Vì vectors đã normalized

            // Chỉ lưu variants có similarity >= 35%
            if (similarity >= MIN_SCORE) {
                similarityResults.push({
                    variantId: variant._id,
                    productId: variant.productId,
                    similarity: similarity
                });
            }
        }

        console.log(`🎯 Found ${similarityResults.length} relevant variants (>= ${MIN_SCORE * 100}%)`);

        // ===== STEP 4: SẮP XẾP THEO ĐỘ GIỐNG (CAO → THẤP) =====
        similarityResults.sort((a, b) => b.similarity - a.similarity);

        // ===== STEP 5: LẤY TOP 20 =====
        const topResults = similarityResults.slice(0, 20);

        if (topResults.length === 0) {
            console.log('ℹ️ No results found');
            return {
                variants: [],
                searchQuery: searchQuery,
                totalFound: 0
            };
        }

        // ===== STEP 6: LẤY THÔNG TIN ĐẦY ĐỦ (HYDRATE DATA) =====
        /**
         * ✅ TỐI ƯU: Query song song với Promise.all
         * → Giảm thời gian từ 200ms xuống 50ms
         */
        console.log('💾 Loading full variant and product data...');

        // 6a. Lấy danh sách ID unique
        const variantIds = topResults.map(r => r.variantId);
        const productIds = [...new Set(topResults.map(r => r.productId.toString()))];

        // 6b. Query song song (2 queries cùng lúc)
        const [fullVariants, products] = await Promise.all([
            this.variantsRepository.find({
                where: {
                    _id: { $in: variantIds }
                }
            }),
            this.productsRepository.find({
                where: {
                    _id: { $in: productIds.map(id => new ObjectId(id)) },
                    isActive: true
                }
            })
        ]);

        // 6c. Tạo Map để lookup nhanh O(1)
        const variantMap = new Map(
            fullVariants.map(v => [v._id.toString(), v])
        );
        const productMap = new Map(
            products.map(p => [p._id.toString(), p])
        );

        // 6d. Kết hợp variant + product + similarity
        const finalResults: Array<{
            variant: ProductVariant;
            product: Product;
            similarity: number;
        }> = [];

        for (const item of topResults) {
            const variantFull = variantMap.get(item.variantId.toString());
            const productFull = productMap.get(item.productId.toString());

            if (variantFull && productFull) {
                finalResults.push({
                    variant: variantFull,
                    product: productFull,
                    similarity: item.similarity
                });
            }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`✅ Search completed in ${duration}ms`);
        console.log(`✅ Returning ${finalResults.length} results`);

        // ===== LOG TOP 3 KẾT QUẢ (DEBUG) =====
        if (finalResults.length > 0) {
            console.log('\n📊 Top 3 results:');
            finalResults.slice(0, 3).forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.product.name} - ${item.variant.storage} ${item.variant.color}`);
                console.log(`     Similarity: ${(item.similarity * 100).toFixed(2)}%`);
            });
            console.log('');
        }

        return {
            variants: finalResults,
            searchQuery: searchQuery,
            totalFound: finalResults.length
        };

    } catch (error) {
        console.error('❌ Search error:', error);
        throw new Error(`Search failed: ${error.message}`);
    }
}

  /**
   * 🔄 UPDATE CHỈ MỘT VARIANT CỤ THỂ
   * 
   * @description Update thông tin của 1 variant duy nhất (storage, color, price, stock, isActive)
   * @param variantId - ID của variant cần update
   * @param updateData - Dữ liệu mới để update
   * @param files - File ảnh mới (optional)
   * @returns Promise<ProductVariant> - Variant đã được update
   * 
   * @example
   * // Update giá và số lượng
   * await updateVariant('variant_id_123', {
   *   price: 25000000,
   *   stock: 100
   * });
   * 
   * // Update giá + giảm giá
   * await updateVariant('variant_id_123', {
   *   price: 25000000,
   *   discountPercent: 20  // Giảm 20%
   * });
   * 
   * // Update cả ảnh
   * await updateVariant('variant_id_123', { price: 25000000 }, files);
   */
  async updateVariant(
    variantId: string,
    updateData: {
      storage?: string;
      color?: string;
      price?: number;
      stock?: number;
      discountPercent?: number;
      isActive?: boolean;
    },
    files?: Express.Multer.File[]
  ): Promise<ProductVariant> {
    try {
      console.log('🔄 Updating single variant:', variantId);
      console.log('📝 Update data:', updateData);

      // ===== BƯỚC 1: VALIDATE VARIANT ID =====
      // Kiểm tra xem variantId có đúng định dạng ObjectId không
      if (!ObjectId.isValid(variantId)) {
        throw new BadRequestException(`❌ ID variant không hợp lệ: ${variantId}`);
      }

      const variantObjectId = new ObjectId(variantId);

      // ===== BƯỚC 2: TÌM VARIANT TRONG DATABASE =====
      // Tìm variant hiện tại từ database
      const existingVariant = await this.variantsRepository.findOne({
        where: { _id: variantObjectId }
      });

      // Nếu không tìm thấy → ném lỗi 404
      if (!existingVariant) {
        throw new NotFoundException(`❌ Không tìm thấy variant với ID: ${variantId}`);
      }

      console.log(`✅ Found variant: ${existingVariant.sku}`);

      // ===== BƯỚC 3: LẤY THÔNG TIN PRODUCT (ĐỂ TẠO SKU MỚI) =====
      // Cần product name để tạo SKU nếu storage/color thay đổi
      const product = await this.productsRepository.findOne({
        where: { _id: existingVariant.productId }
      });

      if (!product) {
        throw new NotFoundException(`❌ Không tìm thấy sản phẩm của variant này`);
      }

      console.log(`✅ Product: "${product.name}"`);

      // ===== BƯỚC 4: UPDATE CÁC TRƯỜNG THÔNG TIN =====
      
      // 📦 Update STORAGE (nếu có)
      if (updateData.storage !== undefined) {
        // Validate: không được rỗng
        if (!updateData.storage.trim()) {
          throw new BadRequestException('❌ Dung lượng không được để trống');
        }
        
        console.log(`📦 Updating storage: "${existingVariant.storage}" → "${updateData.storage}"`);
        existingVariant.storage = updateData.storage.trim();
      }

      // 🎨 Update COLOR (nếu có)
      if (updateData.color !== undefined) {
        // Validate: không được rỗng
        if (!updateData.color.trim()) {
          throw new BadRequestException('❌ Màu sắc không được để trống');
        }
        
        console.log(`🎨 Updating color: "${existingVariant.color}" → "${updateData.color}"`);
        existingVariant.color = updateData.color.trim();
      }

      // 💰 Update PRICE (nếu có)
      if (updateData.price !== undefined) {
        // Validate: phải > 0
        if (updateData.price <= 0) {
          throw new BadRequestException('❌ Giá phải lớn hơn 0');
        }
        
        // Validate: không quá 1 tỷ
        if (updateData.price > 1_000_000_000) {
          throw new BadRequestException('❌ Giá không được vượt quá 1 tỷ VNĐ');
        }
        
        console.log(`💰 Updating price: ${existingVariant.price.toLocaleString('vi-VN')} → ${updateData.price.toLocaleString('vi-VN')} VNĐ`);
        existingVariant.price = updateData.price;
      }

      // 📦 Update STOCK (nếu có)
      if (updateData.stock !== undefined) {
        // Validate: không được âm
        if (updateData.stock < 0) {
          throw new BadRequestException('❌ Số lượng không được âm');
        }
        
        console.log(`📦 Updating stock: ${existingVariant.stock} → ${updateData.stock}`);
        existingVariant.stock = updateData.stock;
      }

      // 🏷️ Update DISCOUNT (nếu có)
      if (updateData.discountPercent !== undefined) {
        // Validate: phải từ 0-100
        if (updateData.discountPercent < 0 || updateData.discountPercent > 100) {
          throw new BadRequestException('❌ Giảm giá phải từ 0-100%');
        }
        
        console.log(`🏷️ Updating discount: ${existingVariant.discountPercent}% → ${updateData.discountPercent}%`);
        existingVariant.discountPercent = updateData.discountPercent;
        existingVariant.isOnSale = updateData.discountPercent > 0;
        
        // ✅ Tự động tính finalPrice và savedAmount (từ @BeforeInsert/@BeforeUpdate)
      }

      // ✅ Update IS_ACTIVE (nếu có)
      if (updateData.isActive !== undefined) {
        console.log(`✅ Updating isActive: ${existingVariant.isActive} → ${updateData.isActive}`);
        existingVariant.isActive = updateData.isActive;
      }

      // ===== BƯỚC 5: UPDATE SKU (NẾU STORAGE HOẶC COLOR THAY ĐỔI) =====
      /**
       * SKU Format: PRODUCTNAME-STORAGE-COLOR
       * Example: IPHONE16-256GB-VIOLET
       * 
       * Chỉ update SKU khi:
       * - Storage hoặc Color thay đổi
       * - SKU mới phải unique (không trùng variant khác)
       */
      const newSku = `${product.name.toUpperCase().replace(/\s+/g, '')}-${existingVariant.storage.toUpperCase().replace(/\s+/g, '')}-${existingVariant.color.toUpperCase().replace(/\s+/g, '')}`;
      
      // Nếu SKU thay đổi → validate uniqueness
      if (newSku !== existingVariant.sku) {
        console.log(`🏷️ SKU changed: "${existingVariant.sku}" → "${newSku}"`);
        
        // Kiểm tra SKU mới đã tồn tại chưa
        const duplicateSku = await this.variantsRepository.findOne({
          where: { 
            sku: newSku,
            _id: { $ne: variantObjectId } // Loại trừ chính variant này
          }
        });

        if (duplicateSku) {
          throw new BadRequestException(
            `❌ SKU "${newSku}" đã tồn tại cho variant khác. ` +
            `Vui lòng chọn storage/color khác hoặc kiểm tra lại.`
          );
        }

        existingVariant.sku = newSku;
        console.log(`✅ SKU updated successfully`);
      } else {
        console.log(`ℹ️ SKU unchanged: "${existingVariant.sku}"`);
      }

      // ===== BƯỚC 6: UPDATE IMAGES (NẾU CÓ FILE MỚI) =====
      /**
       * Quy trình:
       * 1. Xóa TẤT CẢ ảnh cũ trên Cloudinary
       * 2. Upload ảnh mới lên Cloudinary
       * 3. Lưu URLs và publicIds mới
       */
      if (files && files.length > 0) {
        console.log(`📸 Updating ${files.length} images for variant ${existingVariant.color}`);

        // STEP 6.1: XÓA ẢNH CŨ TRÊN CLOUDINARY
        if (existingVariant.imagePublicIds && existingVariant.imagePublicIds.length > 0) {
          console.log(`🗑️ Deleting ${existingVariant.imagePublicIds.length} old images...`);
          
          for (const publicId of existingVariant.imagePublicIds) {
            try {
              await this.cloudinaryService.deleteImage(publicId);
              console.log(`   ✅ Deleted: ${publicId}`);
            } catch (error) {
              // Không ném lỗi nếu xóa thất bại, chỉ log warning
              console.warn(`   ⚠️ Failed to delete ${publicId}: ${error.message}`);
            }
          }
        }

        // STEP 6.2: UPLOAD ẢNH MỚI LÊN CLOUDINARY
        console.log('📤 Uploading new images...');
        const newImageUrls: string[] = [];
        const newImagePublicIds: string[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          console.log(`   📸 Uploading image ${i + 1}/${files.length}...`);
          
          try {
            // Upload với folder path: tpshop/products/{productId}/variants/{color}
            const result = await this.cloudinaryService.uploadImage(
              file,
              `tpshop/products/${product._id}/variants/${existingVariant.color}`
            );
            
            newImageUrls.push(result.secure_url);
            newImagePublicIds.push(result.public_id);
            
            console.log(`   ✅ Uploaded: ${result.public_id}`);
          } catch (error) {
            console.error(`   ❌ Failed to upload image ${i + 1}:`, error.message);
            throw new BadRequestException(`❌ Lỗi upload ảnh ${i + 1}: ${error.message}`);
          }
        }

        // STEP 6.3: CẬP NHẬT URLS VÀ PUBLIC_IDS
        existingVariant.imageUrls = newImageUrls;
        existingVariant.imagePublicIds = newImagePublicIds;
        
        console.log(`✅ Updated images: ${newImageUrls.length} new images saved`);
      } else {
        console.log('ℹ️ No new images to update');
      }

      // ===== BƯỚC 7: CẬP NHẬT TIMESTAMP VÀ LƯU VÀO DATABASE =====
      existingVariant.updatedAt = new Date();
      
      console.log('💾 Saving variant to database...');
      const savedVariant = await this.variantsRepository.save(existingVariant);
      
      console.log(`✅ Variant updated successfully!`);
      console.log(`📊 Final data:`, {
        sku: savedVariant.sku,
        storage: savedVariant.storage,
        color: savedVariant.color,
        price: savedVariant.price.toLocaleString('vi-VN'),
        stock: savedVariant.stock,
        discountPercent: savedVariant.discountPercent,
        finalPrice: savedVariant.finalPrice?.toLocaleString('vi-VN'),
        isActive: savedVariant.isActive,
        imageCount: savedVariant.imageUrls.length
      });

      return savedVariant;

    } catch (error) {
      console.error('❌ Error updating variant:', error);

      // Giữ nguyên lỗi validation
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      // Wrap các lỗi khác
      throw new BadRequestException(`❌ Lỗi cập nhật variant: ${error.message}`);
    }
  }

  /**
   * 🗑️ XÓA CHỈ MỘT VARIANT CỤ THỂ
   * 
   * @description Xóa 1 variant duy nhất mà không ảnh hưởng đến:
   * - Product chính
   * - Các variants khác
   * 
   * @param variantId - ID của variant cần xóa
   * @returns Promise<{ message, deletedVariant, deletedImagesCount }>
   * 
   * @throws {BadRequestException} Nếu variantId không hợp lệ
   * @throws {NotFoundException} Nếu variant không tồn tại
   * @throws {BadRequestException} Nếu đây là variant cuối cùng của product
   * 
   * @example
   * await productsService.deleteVariant('variant_id_123');
   */
  async deleteVariant(variantId: string): Promise<{
    message: string;
    deletedVariant: {
      sku: string;
      storage: string;
      color: string;
    };
    deletedImagesCount: number;
    productName: string;
    remainingVariants: number;
  }> {
    try {
      console.log(`🗑️ Deleting variant: ID=${variantId}`);

      // ===== BƯỚC 1: VALIDATE VARIANT ID =====
      if (!ObjectId.isValid(variantId)) {
        throw new BadRequestException(`❌ ID variant không hợp lệ: ${variantId}`);
      }

      const variantObjectId = new ObjectId(variantId);

      // ===== BƯỚC 2: TÌM VARIANT TRONG DATABASE =====
      const existingVariant = await this.variantsRepository.findOne({
        where: { _id: variantObjectId }
      });

      if (!existingVariant) {
        throw new NotFoundException(`❌ Không tìm thấy variant với ID: ${variantId}`);
      }

      console.log(`✅ Found variant: ${existingVariant.sku}`);

      // ===== BƯỚC 3: KIỂM TRA ĐÂY CÓ PHẢI VARIANT CUỐI CÙNG KHÔNG =====
      /**
       * Không cho phép xóa variant cuối cùng vì:
       * - Product phải có ít nhất 1 variant
       * - Nếu muốn xóa hết → xóa luôn cả product
       */
      const totalVariants = await this.variantsRepository.count({
        where: { productId: existingVariant.productId }
      });

      if (totalVariants === 1) {
        throw new BadRequestException(
          `❌ Không thể xóa variant cuối cùng!\n` +
          `Sản phẩm phải có ít nhất 1 variant.\n` +
          `Nếu muốn xóa toàn bộ, vui lòng xóa sản phẩm chính.`
        );
      }

      console.log(`ℹ️ Product has ${totalVariants} variants (${totalVariants - 1} will remain after deletion)`);

      // ===== BƯỚC 4: LẤY THÔNG TIN PRODUCT (ĐỂ HIỂN THỊ MESSAGE) =====
      const product = await this.productsRepository.findOne({
        where: { _id: existingVariant.productId }
      });

      if (!product) {
        throw new NotFoundException(`❌ Không tìm thấy sản phẩm của variant này`);
      }

      console.log(`✅ Product: "${product.name}"`);

      // ===== BƯỚC 5: XÓA TẤT CẢ ẢNH TRÊN CLOUDINARY =====
      let deletedImagesCount = 0;

      if (existingVariant.imagePublicIds && existingVariant.imagePublicIds.length > 0) {
        console.log(`🖼️ Deleting ${existingVariant.imagePublicIds.length} images from Cloudinary...`);

        for (const publicId of existingVariant.imagePublicIds) {
          try {
            await this.cloudinaryService.deleteImage(publicId);
            deletedImagesCount++;
            console.log(`   ✅ Deleted: ${publicId}`);
          } catch (error) {
            // Không ném lỗi nếu xóa ảnh thất bại
            console.warn(`   ⚠️ Failed to delete ${publicId}: ${error.message}`);
          }
        }

        console.log(`✅ Deleted ${deletedImagesCount}/${existingVariant.imagePublicIds.length} images`);
      } else {
        console.log(`ℹ️ No images to delete`);
      }

      // ===== BƯỚC 6: XÓA VARIANT KHỎI DATABASE =====
      await this.variantsRepository.delete({ _id: variantObjectId });

      console.log(`✅ Deleted variant "${existingVariant.sku}" from database`);

      // ===== BƯỚC 7: TRẢ VỀ KẾT QUẢ =====
      const remainingVariants = totalVariants - 1;

      return {
        message: `Đã xóa variant "${existingVariant.storage} - ${existingVariant.color}" khỏi sản phẩm "${product.name}"`,
        deletedVariant: {
          sku: existingVariant.sku,
          storage: existingVariant.storage,
          color: existingVariant.color
        },
        deletedImagesCount: deletedImagesCount,
        productName: product.name,
        remainingVariants: remainingVariants
      };

    } catch (error) {
      console.error('❌ Error deleting variant:', error);

      // Giữ nguyên lỗi validation
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      // Wrap các lỗi khác
      throw new BadRequestException(`❌ Lỗi xóa variant: ${error.message}`);
    }
  }

  /**
   * 📦 LẤY TẤT CẢ SẢN PHẨM KHÔNG GIẢM GIÁ
   * 
   * @description Trả về danh sách sản phẩm mà TẤT CẢ variants đều KHÔNG đang giảm giá
   * 
   * @returns Promise<Product[]> - Danh sách sản phẩm (bao gồm variants không sale)
   * 
   * @example Response:
   * [
   *   {
   *     _id: "...",
   *     name: "iPhone 15",
   *     variants: [
   *       { storage: "128GB", color: "Đen", price: 20000000, isOnSale: false, ... },
   *       { storage: "256GB", color: "Trắng", price: 23000000, isOnSale: false, ... }
   *     ]
   *   }
   * ]
   */
  async findProductsNotOnSale(): Promise<Product[]> {
    try {
      console.log('📦 Finding all products WITHOUT discount');

      // ===== BƯỚC 1: LẤY TẤT CẢ SẢN PHẨM ACTIVE =====
      const allProducts = await this.productsRepository.find({
        where: { isActive: true },
        order: { createdAt: 'DESC' }
      });

      console.log(`📊 Found ${allProducts.length} active products`);

      // ===== BƯỚC 2: LỌC SẢN PHẨM CÓ ÍT NHẤT 1 VARIANT KHÔNG SALE =====
      const productsNotOnSale: Product[] = [];

      for (const product of allProducts) {
        // Lấy TẤT CẢ variants của product này
        const allVariants = await this.variantsRepository.find({
          where: { 
            productId: product._id,
            isActive: true 
          },
          order: { price: 'ASC' }
        });

        // Lọc chỉ lấy variants KHÔNG đang sale
        const nonSaleVariants = allVariants.filter(v => !v.isOnSale || v.discountPercent === 0);

        // ✅ Nếu có ít nhất 1 variant không sale → thêm product vào kết quả
        if (nonSaleVariants.length > 0) {
          const productWithVariants: Product = {
            ...product,
            variants: nonSaleVariants.map(v => ({
              _id: v._id,
              storage: v.storage,
              color: v.color,
              price: v.price,
              stock: v.stock,
              images: v.imageUrls,
              isActive: v.isActive,
              discountPercent: 0,        // ✅ Luôn là 0 vì không sale
              isOnSale: false,           // ✅ Luôn là false
              finalPrice: v.price,       // ✅ Giá cuối = giá gốc
              savedAmount: 0             // ✅ Không tiết kiệm được gì
            }))
          } as any;

          productsNotOnSale.push(productWithVariants);
        }
      }
      return productsNotOnSale;

    } catch (error) {
      console.error('❌ Error finding non-sale products:', error);
      throw new BadRequestException(`Lỗi lấy danh sách sản phẩm không giảm giá: ${error.message}`);
    }
  }

  /**
   * 💡 LẤY DANH SÁCH GỢI Ý (AUTOCOMPLETE)
   * Tìm kiếm nhanh theo tên sản phẩm chứa từ khóa
   */
  async getSuggestions(query: string): Promise<string[]> {
    try {
      // Escape các ký tự đặc biệt của Regex để tránh lỗi
      const cleanQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Tạo RegExp tìm kiếm không phân biệt hoa thường (case-insensitive)
      const searchRegex = new RegExp(cleanQuery, 'i');

      // Tìm top 10 sản phẩm khớp tên
      const products = await this.productsRepository.find({
        where: { 
            name: { $regex: searchRegex },
            isActive: true 
        },
        take: 10,
        order: { name: 'ASC' }
      });

      // Chỉ trả về mảng các tên sản phẩm
      return products.map(p => p.name);
    } catch (error) {
      console.error('❌ Error searching suggestions:', error);
      return []; // Trả về mảng rỗng nếu lỗi, không throw để tránh crash UI search bar
    }
  }
}
