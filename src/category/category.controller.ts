import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
    // @UseGuards(JwtAuthGuard) // Bảo vệ API chỉ cho phép người dùng đã đăng nhập
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  // ✅ Toggle status API
  @Patch(':id/toggle-status')
  toggleStatus(@Param('id') id: string) {
    return this.categoryService.toggleStatus(id);
  }

  // ✅ Soft delete API  
  @Patch(':id/soft-delete')
  softDelete(@Param('id') id: string) {
    return this.categoryService.softDelete(id);
  }

  @Delete(':id')
  // @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
