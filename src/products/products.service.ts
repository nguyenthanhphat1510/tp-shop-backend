import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) { }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create({
      ...createProductDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return this.productsRepository.save(product);

  }

  async findAll(): Promise<Product[]> {
    // Lấy tất cả sản phẩm từ database
    return this.productsRepository.find({
      // Bạn có thể thêm tùy chọn như sắp xếp hoặc lọc
      order: {
        createdAt: 'DESC', // Sắp xếp theo thời gian tạo mới nhất
      },
      // where: { isActive: true }, // Nếu muốn lọc theo sản phẩm đang hoạt động
    });
  }

  // findAll() {
  //   return `This action returns all products`;
  // }

  // findOne(id: number) {
  //   return `This action returns a #${id} product`;
  // }

  // update(id: number, updateProductDto: UpdateProductDto) {
  //   return `This action updates a #${id} product`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} product`;
  // }
}
