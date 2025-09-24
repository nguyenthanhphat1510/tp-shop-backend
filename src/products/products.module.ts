import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Category } from '../category/entities/category.entity';
import { Subcategory } from '../subcategory/entities/subcategory.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant, Category, Subcategory]),
    CloudinaryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
