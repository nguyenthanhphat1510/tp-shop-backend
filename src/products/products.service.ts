import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';
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
        categoryObjectId = new ObjectId(createProductDto.categoryId);
      } else {
        categoryObjectId = createProductDto.categoryId;
      }

      if (typeof createProductDto.subcategoryId === 'string') {
        subcategoryObjectId = new ObjectId(createProductDto.subcategoryId);
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
      where: { isActive: "true" },
      order: { createdAt: 'DESC' }
    });
  }

  // 🎯 THÊM: Tìm sản phẩm theo ID
  async findOne(id: string): Promise<Product> {
    try {
      console.log('🔍 Finding product with ID:', id);
      
      // Kiểm tra ID có hợp lệ không
      if (!ObjectId.isValid(id)) {
        throw new BadRequestException(`ID sản phẩm không hợp lệ: ${id}`);
      }

      // Chuyển đổi string thành ObjectId
      const objectId = new ObjectId(id);
      
      // Tìm sản phẩm trong database
      const product = await this.productsRepository.findOne({
        where: { _id: objectId }
      });

      // Kiểm tra sản phẩm có tồn tại không
      if (!product) {
        console.log('❌ Product not found with ID:', id);
        throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      console.log('✅ Product found successfully:', product.name);
      return product;

    } catch (error) {
      console.error('❌ Error finding product:', error);
      
      // Re-throw known exceptions
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      // Handle unexpected errors
      throw new BadRequestException(`Lỗi tìm kiếm sản phẩm: ${error.message}`);
    }
  }
}
