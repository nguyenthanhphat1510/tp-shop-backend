import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { Subcategory } from '../subcategory/entities/subcategory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Product, Subcategory])],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
