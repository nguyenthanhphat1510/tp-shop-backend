import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseInterceptors, UploadedFiles, Query, BadRequestException } from '@nestjs/common';
import { AnyFilesInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductWithVariantsDto } from './dto/create-product-with-variants.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

/**
 * 🔍 API SEMANTIC SEARCH USING VECTOR
 * ✅ ĐÃ BẬT LẠI
 */
@Get('search-vector')
async searchByVector(@Query('q') q: string) {
  try {
    // Validate input
    if (!q || q.trim().length < 2) {
      return {
        success: false,
        message: 'Vui lòng nhập ít nhất 2 ký tự để tìm kiếm',
        data: {
          variants: [],
          searchQuery: q || '',
          totalFound: 0
        }
      };
    }

    console.log(`🤖 Vector search: "${q}"`);

    // Call service search method
    const result = await this.productsService.searchByVector(q.trim());

    return {
      success: true,
      message: `Tìm thấy ${result.totalFound} sản phẩm cho "${q}"`,
      data: result
    };

  } catch (error) {
    console.error('❌ Search API error:', error);
    return {
      success: false,
      message: `Lỗi tìm kiếm: ${error.message}`,
      data: {
        variants: [],
        searchQuery: q || '',
        totalFound: 0
      }
    };
  }
}

  // ✅ UNLIMITED VARIANTS + 5 IMAGES PER VARIANT
  @Post()
  @UseInterceptors(AnyFilesInterceptor({
    limits: {
      files: 200,  // Tổng files (40 variants x 5 ảnh = 200)
      fileSize: 5 * 1024 * 1024 // 5MB per file
    }
  }))
  async create(
    @Body() createProductDto: CreateProductWithVariantsDto,
    @UploadedFiles() files: Express.Multer.File[]  // ✅ Array instead of object
  ) {
    try {
      console.log('📝 Creating product with', createProductDto.variants?.length, 'variants');

      // ✅ Organize files (helper function)
      const organizedFiles = this.organizeFilesByVariant(files);

      // ✅ Validate max 5 images per variant
      this.validateFilesPerVariant(organizedFiles);

      // ✅ Call service
      const result = await this.productsService.createWithVariants(
        createProductDto,
        organizedFiles
      );

      return {
        success: true,
        message: 'Sản phẩm đã được tạo thành công',
        data: result
      };
    } catch (error) {
      console.error('❌ Error:', error.message);
      return {
        success: false,
        message: error.message,
        statusCode: 400
      };
    }
  }

  // ✅ Helper: Organize files
  private organizeFilesByVariant(files: Express.Multer.File[]) {
    const organized: { [key: string]: Express.Multer.File[] } = {};

    files?.forEach(file => {
      if (!organized[file.fieldname]) {
        organized[file.fieldname] = [];
      }
      organized[file.fieldname].push(file);
    });

    return organized;
  }

  // ✅ Helper: Validate files
  private validateFilesPerVariant(organizedFiles: { [key: string]: Express.Multer.File[] }) {
    for (const [variantKey, variantFiles] of Object.entries(organizedFiles)) {
      if (variantFiles.length > 5) {
        throw new BadRequestException(
          `${variantKey} có ${variantFiles.length} ảnh. Tối đa 5 ảnh/variant`
        );
      }
    }
  }

  // ✅ GET ALL PRODUCTS
  @Get()
  async findAll() {
    try {
      const products = await this.productsService.findAll();
      return {
        success: true,
        data: products
      };
    } catch (error) {
      console.error('❌ Error in findAll:', error);
      throw error;
    }
  }

  // ✅ GET BY PRICE RANGE
  @Get('filter-price')
  async filterByPrice(@Query('priceRangeId') priceRangeId: string) {
    try {
      const products = await this.productsService.findByPriceRange(priceRangeId);
      return {
        success: true,
        data: products
      };
    } catch (error) {
      console.error('❌ Error in filterByPrice:', error);
      throw error;
    }
  }

  // ✅ GET DISCOUNT STATS - Move before :id routes
  @Get('discounts/stats')
  async getDiscountStats() {
    try {
      const stats = await this.productsService.getDiscountStats();

      return {
        success: true,
        message: 'Thống kê giảm giá',
        data: stats
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ GET SALE VARIANTS - Move before :id routes
  @Get('sale/variants')
  async getVariantsOnSale() {
    try {
      const saleVariants = await this.productsService.getVariantsOnSale();

      return {
        success: true,
        message: `Tìm thấy ${saleVariants.length} variants đang giảm giá`,
        data: saleVariants
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('not-on-sale')
  async getProductsNotOnSale() {
    try {
      console.log('📦 [GET] /products/not-on-sale - Request received');

      const products = await this.productsService.findProductsNotOnSale();

      console.log(`✅ Returning ${products.length} products not on sale`);

      return {
        success: true,
        message: 'Lấy danh sách sản phẩm không giảm giá thành công',
        data: products,
        total: products.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error in getProductsNotOnSale:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Lỗi lấy sản phẩm không giảm giá: ${error.message}`);
    }
  }


  // ✅ GET ONE VARIANT BY ID - Move BEFORE :id route to avoid conflict
  @Get('variants/:variantId')
  async findOneVariant(@Param('variantId') variantId: string) {
    try {
      console.log('🔍 GET /products/variants/:variantId', variantId);

      const result = await this.productsService.findOneVariant(variantId);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Error in findOneVariant:', error);
      throw error;
    }
  }

  // ✅ GET BY CATEGORY
  @Get('category/:categoryId')
  async findByCategory(@Param('categoryId') categoryId: string) {
    try {
      const products = await this.productsService.findByCategory(categoryId);
      return {
        success: true,
        data: products
      };
    } catch (error) {
      console.error('❌ Error in findByCategory:', error);
      throw error;
    }
  }

  // ✅ GET BY ID - Must be AFTER specific routes
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.productsService.findOne(id);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Error in findOne:', error);
      throw error;
    }
  }

  @Patch('variants/:variantId')
  @UseInterceptors(FilesInterceptor('images', 5))
  async updateVariant(
    @Param('variantId') variantId: string,
    @Body() updateData: {
      storage?: string;
      color?: string;
      price?: number;
      stock?: number;
      discountPercent?: number;
      isActive?: boolean;
    },
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    try {
      const updatedVariant = await this.productsService.updateVariant(
        variantId,
        updateData,
        files
      );

      return {
        success: true,
        message: 'Cập nhật variant thành công',
        data: updatedVariant
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ TOGGLE STATUS CHO 1 VARIANT
  @Patch('variants/:variantId/toggle')
  async toggleVariantStatus(@Param('variantId') variantId: string) {
    try {
      const variant = await this.productsService.toggleVariantStatus(variantId);

      return {
        success: true,
        message: `Variant đã được ${variant.isActive ? 'kích hoạt' : 'tạm dừng'}`,
        data: variant
      };
    } catch (error) {
      console.error('❌ Error in toggleVariantStatus:', error);
      throw error;
    }
  }



  // ✅ API: Giảm giá cho 1 variant cụ thể
  @Patch(':productId/variants/:variantId/discount')
  async applyVariantDiscount(
    @Param('variantId') variantId: string,
    @Body() body: { discountPercent: number }
  ) {
    try {
      const updatedVariant = await this.productsService.applyDiscountToVariant(
        variantId,
        body.discountPercent
      );

      return {
        success: true,
        message: `Đã áp dụng giảm giá ${body.discountPercent}% cho variant`,
        data: {
          variantId: updatedVariant._id,
          sku: updatedVariant.sku,
          originalPrice: updatedVariant.price.toLocaleString('vi-VN'),
          discountPercent: updatedVariant.discountPercent,
          finalPrice: updatedVariant.finalPrice.toLocaleString('vi-VN'),
          savedAmount: updatedVariant.savedAmount.toLocaleString('vi-VN'),
          isOnSale: updatedVariant.isOnSale
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ API: Bỏ giảm giá cho 1 variant
  @Delete(':productId/variants/:variantId/discount')
  async removeVariantDiscount(@Param('variantId') variantId: string) {
    try {
      const updatedVariant = await this.productsService.removeDiscountFromVariant(variantId);

      return {
        success: true,
        message: 'Đã bỏ giảm giá cho variant',
        data: {
          variantId: updatedVariant._id,
          sku: updatedVariant.sku,
          price: updatedVariant.price.toLocaleString('vi-VN'),
          discountPercent: updatedVariant.discountPercent,
          isOnSale: updatedVariant.isOnSale
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ API: Giảm giá cho TẤT CẢ variants của product
  @Patch(':productId/discount')
  async applyProductDiscount(
    @Param('productId') productId: string,
    @Body() body: { discountPercent: number }
  ) {
    try {
      const updatedVariants = await this.productsService.applyDiscountToProduct(
        productId,
        body.discountPercent
      );

      return {
        success: true,
        message: `Đã áp dụng giảm giá ${body.discountPercent}% cho ${updatedVariants.length} variants`,
        data: {
          productId,
          discountPercent: body.discountPercent,
          affectedVariants: updatedVariants.length,
          variants: updatedVariants.map(variant => ({
            variantId: variant._id,
            sku: variant.sku,
            name: `${variant.storage} - ${variant.color}`,
            originalPrice: variant.price.toLocaleString('vi-VN'),
            finalPrice: variant.finalPrice.toLocaleString('vi-VN'),
            savedAmount: variant.savedAmount.toLocaleString('vi-VN')
          }))
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ XÓA CHỈ MỘT VARIANT CỤ THỂ
  @Delete('variants/:variantId')
  async deleteVariant(@Param('variantId') variantId: string) {
    try {
      const result = await this.productsService.deleteVariant(variantId);

      return {
        success: true,
        message: result.message,
        data: result
      };
    } catch (error) {
      console.error('❌ Error in deleteVariant:', error);
      throw error;
    }
  }
  
}
