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

  // ✅ TOGGLE STATUS - CÓ KIỂM TRA RÀNG BUỘC
  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id') id: string) {
    try {
      const result = await this.subcategoryService.toggleStatus(id);
      return result;
    } catch (error) {
      console.error('❌ Error in toggleStatus endpoint:', error);
      throw error;
    }
  }

 // ✅ HARD DELETE - XÓA VĨNH VIỄN
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      console.log(`🗑️ Controller: Deleting subcategory ${id}`);
      
      const result = await this.subcategoryService.remove(id);
      
      console.log('✅ Controller: Delete result:', result);
      
      return {
        success: true,
        message: result.message,
        data: result.deletedSubcategory
      };
    } catch (error) {
      console.error('❌ Controller: Error in remove endpoint:', error);
      throw error;
    }
  }

   // API lấy sản phẩm theo subcategory
  @Get(':id/products')
  getProductsBySubcategory(@Param('id') id: string) {
    return this.subcategoryService.getProductsBySubcategory(id);
  }

}


