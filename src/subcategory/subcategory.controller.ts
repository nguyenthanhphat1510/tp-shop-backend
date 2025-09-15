import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Query } from '@nestjs/common';
import { SubcategoryService } from './subcategory.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

@Controller('subcategories')
export class SubcategoryController {
  constructor(private readonly subcategoryService: SubcategoryService) {}

  @Post()
  create(@Body() createSubcategoryDto: CreateSubcategoryDto) {
    return this.subcategoryService.create(createSubcategoryDto);
  }

  @Get()
  findAll() {
    return this.subcategoryService.findAll();
  }

  @Get('category/:categoryId')
  findByCategoryId(@Param('categoryId') categoryId: string) {
    return this.subcategoryService.findByCategoryId(categoryId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subcategoryService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateSubcategoryDto: UpdateSubcategoryDto) {
    return this.subcategoryService.update(id, updateSubcategoryDto);
  }

  // ✅ Toggle status API
  @Patch(':id/toggle-status')
  toggleStatus(@Param('id') id: string) {
    return this.subcategoryService.toggleStatus(id);
  }

  // ✅ Soft delete API
  @Patch(':id/soft-delete')
  softDelete(@Param('id') id: string) {
    return this.subcategoryService.softDelete(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subcategoryService.remove(id);
  }

   // API lấy sản phẩm theo subcategory
  @Get(':id/products')
  getProductsBySubcategory(@Param('id') id: string) {
    return this.subcategoryService.getProductsBySubcategory(id);
  }

}


