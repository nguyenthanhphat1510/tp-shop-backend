import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Query } from '@nestjs/common';
import { SubcategoryService } from './subcategory.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

@Controller('subcategories')
export class SubcategoryController {
  constructor(private readonly subcategoryService: SubcategoryService) {}

  // ✅ CREATE - THÊM ERROR HANDLING
  @Post()
  async create(@Body() createSubcategoryDto: CreateSubcategoryDto) {
    try {
      console.log('📥 Controller: Creating subcategory:', createSubcategoryDto);
      
      const result = await this.subcategoryService.create(createSubcategoryDto);
      
      console.log('✅ Controller: Subcategory created successfully');
      
      return result;
    } catch (error) {
      console.error('❌ Controller: Error in create endpoint:', error);
      throw error;
    }
  }

  @Get()
  findAll() {
    return this.subcategoryService.findAll();
  }

  // ✅ FIX: ĐƯA ROUTE CỐ ĐỊNH LÊN TRƯỚC
  @Get('category/:categoryId')
  findByCategoryId(@Param('categoryId') categoryId: string) {
    return this.subcategoryService.findByCategoryId(categoryId);
  }

  // ✅ ROUTE ĐỘNG + SUFFIX (TRƯỚC :id)
  @Get(':id/products')
  getProductsBySubcategory(@Param('id') id: string) {
    return this.subcategoryService.getProductsBySubcategory(id);
  }

  // ✅ ROUTE ĐỘNG (CUỐI CÙNG)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subcategoryService.findOne(id);
  }

  // ✅ UPDATE - THÊM ERROR HANDLING
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateSubcategoryDto: UpdateSubcategoryDto) {
    try {
      console.log(`📥 Controller: Updating subcategory ${id}:`, updateSubcategoryDto);
      
      const result = await this.subcategoryService.update(id, updateSubcategoryDto);
      
      console.log('✅ Controller: Subcategory updated successfully');
      
      return result;
    } catch (error) {
      console.error('❌ Controller: Error in update endpoint:', error);
      throw error;
    }
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
}


