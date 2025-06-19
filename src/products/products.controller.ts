import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  // @UseGuards(JwtAuthGuard) // Bảo vệ route này với JWT (tùy chọn, nếu bạn muốn chỉ người đăng nhập mới được thêm)
  @UsePipes(new ValidationPipe())
  async create(@Body() createProductDto: CreateProductDto) {
    const product = await this.productsService.create(createProductDto);
    return {
      success: true,
      message: 'Product created successfully',
      data: product
    };
  }

 @Get()
  async findAll() {
    return this.productsService.findAll();
  }
}
