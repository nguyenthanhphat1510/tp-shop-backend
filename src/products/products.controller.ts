import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseInterceptors,
  UploadedFiles,
  Query
} from '@nestjs/common';
import { FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductWithVariantsDto } from './dto/create-product-with-variants.dto'; // ✅ Import DTO mới
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  // ✅ POST /products - Tạo sản phẩm với variants
  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'variant_0_images', maxCount: 10 },
    { name: 'variant_1_images', maxCount: 10 },
    { name: 'variant_2_images', maxCount: 10 },
    { name: 'variant_3_images', maxCount: 10 },
    { name: 'variant_4_images', maxCount: 10 },
  ]))
  async create(
    @Body() body: any, // ✅ Thay đổi thành any để parse thủ công
    @UploadedFiles() files: { [fieldname: string]: Express.Multer.File[] }
  ) {
    try {
      console.log('📝 POST /products - Tạo sản phẩm với variants');
      console.log('📋 Raw body:', JSON.stringify(body, null, 2));
      
      // ✅ VALIDATION & PARSING
      if (!body.name || !body.description || !body.categoryId || !body.variants) {
        throw new Error('Thiếu thông tin bắt buộc: name, description, categoryId, variants');
      }
      
      // Parse variants từ JSON string
      let parsedVariants = [];
      try {
        parsedVariants = typeof body.variants === 'string' 
          ? JSON.parse(body.variants) 
          : body.variants;
        
        if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
          throw new Error('Variants phải là array không rỗng');
        }
        
        console.log('✅ Parsed variants:', parsedVariants);
      } catch (error) {
        throw new Error('Lỗi parse variants JSON: ' + error.message);
      }
      
      // ✅ TẠO DTO ĐÚNG FORMAT
      const createProductDto: CreateProductWithVariantsDto = {
        name: body.name.toString().trim(),
        description: body.description.toString().trim(),
        categoryId: body.categoryId.toString().trim(),
        subcategoryId: (body.subcategoryId || body.categoryId).toString().trim(),
        variants: parsedVariants
      };
      
      console.log('📋 Final DTO:', JSON.stringify(createProductDto, null, 2));
      console.log('📸 Files keys:', files ? Object.keys(files) : 'no files');

      const result = await this.productsService.create(createProductDto, files);

      return {
        success: true,
        message: 'Sản phẩm đã được tạo thành công với variants',
        data: result
      };
    } catch (error) {
      console.error('❌ CONTROLLER ERROR:', error.message);
      console.error('❌ STACK:', error.stack);
      
      return {
        success: false,
        message: `❌ Lỗi tạo sản phẩm: ${error.message}`,
        error: "Bad Request",
        statusCode: 400
      };
    }
  }

  // GET /products - Lấy tất cả sản phẩm
  @Get()
  async findAll() {
    try {
      console.log('📋 GET /products');
      const products = await this.productsService.findAll();
      return {
        success: true,
        data: products
      };
    } catch (error) {
      console.error('❌ Error in findAll controller:', error);
      throw error;
    }
  }

  // GET /products/filter-price - Lọc theo giá
  @Get('filter-price')
  async filterByPrice(@Query('priceRangeId') priceRangeId: string) {
    try {
      console.log('💰 GET /products/filter-price?priceRangeId=' + priceRangeId);
      const products = await this.productsService.findByPriceRange(priceRangeId);
      return {
        success: true,
        data: products
      };
    } catch (error) {
      console.error('❌ Error in filterByPrice controller:', error);
      throw error;
    }
  }

  // GET /products/category/:categoryId - Lấy theo category
  @Get('category/:categoryId')
  async findByCategory(@Param('categoryId') categoryId: string) {
    try {
      console.log(`📂 GET /products/category/${categoryId}`);
      const products = await this.productsService.findByCategory(categoryId);
      return {
        success: true,
        data: products
      };
    } catch (error) {
      console.error('❌ Error in findByCategory controller:', error);
      throw error;
    }
  }

  // GET /products/:id - Lấy sản phẩm theo ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      console.log('📋 GET /products/:id', id);
      return await this.productsService.findOne(id);
    } catch (error) {
      console.error('❌ Error in findOne controller:', error);
      throw error;
    }
  }

  // PATCH /products/:id/toggle - Toggle trạng thái
  @Patch(':id/toggle')
  async toggleStatus(@Param('id') id: string) {
    try {
      console.log(`🔄 PATCH /products/${id}/toggle`);

      const updatedProduct = await this.productsService.toggleStatus(id);

      return {
        success: true,
        message: `Sản phẩm đã được ${updatedProduct.product.isActive ? 'kích hoạt' : 'tạm dừng'}`,
        data: updatedProduct,
        newStatus: updatedProduct.product.isActive ? 'active' : 'inactive'
      };
    } catch (error) {
      console.error('❌ Error in toggleStatus controller:', error);
      throw error;
    }
  }

  // DELETE /products/:id - Soft delete
  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    try {
      console.log(`🗑️ DELETE /products/${id}`);

      const deletedProduct = await this.productsService.softDelete(id);

      return {
        success: true,
        message: 'Sản phẩm đã được chuyển sang trạng thái tạm dừng',
        data: deletedProduct
      };
    } catch (error) {
      console.error('❌ Error in softDelete controller:', error);
      throw error;
    }
  }

  // ❌ TẠM THỜI BỎ UPDATE VÀ PARTIAL UPDATE - SẼ IMPLEMENT SAU
  // @Put(':id')
  @Put(':id')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'variant_0_images', maxCount: 10 },
    { name: 'variant_1_images', maxCount: 10 },
    { name: 'variant_2_images', maxCount: 10 },
    { name: 'variant_3_images', maxCount: 10 },
    { name: 'variant_4_images', maxCount: 10 },
    // Add more as needed
  ]))
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles() files?: { [fieldname: string]: Express.Multer.File[] }
  ) {
    try {
      console.log('🔄 PUT /products/:id', id, updateProductDto);
      return await this.productsService.update(id, updateProductDto, files);
    } catch (error) {
      console.error('❌ Error in update controller:', error);
      throw error;
    }
  }
}
