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
  UploadedFiles 
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // GET /products - Lấy tất cả sản phẩm
  @Get()
  async findAll() {
    try {
      console.log('📋 GET /products');
      const products = await this.productsService.findAll();
      return products;
    } catch (error) {
      console.error('❌ Error in findAll controller:', error);
      throw error;
    }
  }

  // GET /products/:id - Lấy sản phẩm theo ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      console.log(`📋 GET /products/${id}`);
      const product = await this.productsService.findOne(id);
      return {
        success: true,
        data: product
      };
    } catch (error) {
      console.error('❌ Error in findOne controller:', error);
      throw error;
    }
  }

  // ✅ PATCH /products/:id/toggle - Toggle trạng thái (true ↔ false)
  @Patch(':id/toggle')
  async toggleStatus(@Param('id') id: string) {
    try {
      console.log(`🔄 PATCH /products/${id}/toggle`);
      
      const updatedProduct = await this.productsService.toggleStatus(id);
      
      return {
        success: true,
        message: `Sản phẩm đã được ${updatedProduct.isActive ? 'kích hoạt' : 'tạm dừng'}`,
        data: updatedProduct,
        newStatus: updatedProduct.isActive ? 'active' : 'inactive'
      };
    } catch (error) {
      console.error('❌ Error in toggleStatus controller:', error);
      throw error;
    }
  }

  // ✅ DELETE /products/:id - Soft delete (luôn chuyển thành false)
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

  // POST /products - Tạo sản phẩm mới
  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  async create(
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    try {
      console.log('📝 POST /products');
      const product = await this.productsService.create(createProductDto, files);
      return {
        success: true,
        message: 'Tạo sản phẩm thành công',
        data: product
      };
    } catch (error) {
      console.error('❌ Error in create controller:', error);
      throw error;
    }
  }

  // ✅ PUT /products/:id - Full update sản phẩm
  @Put(':id')
  @UseInterceptors(FilesInterceptor('files', 10))
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    try {
      console.log(`📝 PUT /products/${id}`);
      console.log('Update data:', updateProductDto);
      console.log('Files count:', files?.length || 0);
      
      const updatedProduct = await this.productsService.update(id, updateProductDto, files);
      
      return {
        success: true,
        message: 'Cập nhật sản phẩm thành công',
        data: updatedProduct
      };
    } catch (error) {
      console.error('❌ Error in update controller:', error);
      throw error;
    }
  }

  // ✅ PATCH /products/:id - Partial update sản phẩm
  @Patch(':id')
  async partialUpdate(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateProductDto>
  ) {
    try {
      console.log(`🔧 PATCH /products/${id}`);
      console.log('Partial update data:', updateData);
      
      const updatedProduct = await this.productsService.partialUpdate(id, updateData);
      
      return {
        success: true,
        message: 'Cập nhật sản phẩm thành công',
        data: updatedProduct
      };
    } catch (error) {
      console.error('❌ Error in partialUpdate controller:', error);
      throw error;
    }
  }
}
