import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository, ObjectId } from 'typeorm';
import { ObjectId as MongoObjectId } from 'mongodb';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { Category } from '../category/entities/category.entity';
import { Subcategory } from '../subcategory/entities/subcategory.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: MongoRepository<Product>,
    @InjectRepository(Category)
    private categoryRepository: MongoRepository<Category>,
    @InjectRepository(Subcategory)
    private subcategoryRepository: MongoRepository<Subcategory>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(createProductDto: CreateProductDto, file?: Express.Multer.File): Promise<Product> {
    try {
      console.log('Creating product with data:', createProductDto);
      
      // Chuyển đổi categoryId và subcategoryId
      let categoryObjectId: ObjectId;
      let subcategoryObjectId: ObjectId;
      
      if (typeof createProductDto.categoryId === 'string') {
        categoryObjectId = new MongoObjectId(createProductDto.categoryId);
      } else {
        categoryObjectId = createProductDto.categoryId;
      }

      if (typeof createProductDto.subcategoryId === 'string') {
        subcategoryObjectId = new MongoObjectId(createProductDto.subcategoryId);
      } else {
        subcategoryObjectId = createProductDto.subcategoryId;
      }

      // Kiểm tra category
      const category = await this.categoryRepository.findOne({
        where: { _id: categoryObjectId }
      });

      if (!category) {
        throw new NotFoundException(`Không tìm thấy danh mục với ID ${createProductDto.categoryId}`);
      }

      // Kiểm tra subcategory
      const subcategory = await this.subcategoryRepository.findOne({
        where: { _id: subcategoryObjectId }
      });

      if (!subcategory) {
        throw new NotFoundException(`Không tìm thấy danh mục con với ID ${createProductDto.subcategoryId}`);
      }

      // Kiểm tra subcategory có thuộc category không
      if (subcategory.categoryId.toString() !== categoryObjectId.toString()) {
        throw new BadRequestException('Danh mục con không thuộc danh mục đã chọn');
      }

      // Kiểm tra tên sản phẩm đã tồn tại
      const existingProduct = await this.productsRepository.findOne({
        where: { name: createProductDto.name }
      });
      
      if (existingProduct) {
        throw new BadRequestException(`Sản phẩm với tên "${createProductDto.name}" đã tồn tại`);
      }

      // Upload ảnh lên Cloudinary nếu có
      let imageUrl = '';
      let imagePublicId = '';
      
      if (file) {
        const uploadResult = await this.cloudinaryService.uploadImage(file, 'tpshop/products');
        imageUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
        console.log('Image uploaded to Cloudinary:', imageUrl);
      }

      // Tạo sản phẩm mới
      const productData = {
        name: createProductDto.name,
        description: createProductDto.description,
        price: createProductDto.price,
        imageUrl: imageUrl,
        imagePublicId: imagePublicId,
        categoryId: categoryObjectId,
        subcategoryId: subcategoryObjectId,
        stock: createProductDto.stock || 0,
        isActive: createProductDto.isActive ?? true
      };

      const newProduct = this.productsRepository.create(productData);
      const savedProduct = await this.productsRepository.save(newProduct);
      
      console.log('Product created successfully:', savedProduct);
      return savedProduct;

    } catch (error) {
      console.error('Error creating product:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi tạo sản phẩm: ${error.message}`);
    }
  }

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' }
    });
  }
}
