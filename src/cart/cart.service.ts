import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository, ObjectId } from 'typeorm';
import { CartItem } from './entities/cart.entity';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private cartRepository: MongoRepository<CartItem>,
  ) {}

  // ✅ Thêm sản phẩm vào giỏ hàng
  async addToCart(userId: string, createCartDto: CreateCartDto): Promise<CartItem> {
    const { productId, quantity = 1 } = createCartDto;

    // Validate quantity
    if (quantity < 1 || quantity > 3) {
      throw new BadRequestException('Số lượng phải từ 1 đến 3');
    }

    // TODO: Validate product exists and stock (cần implement Product service)
    // const product = await this.productService.findOne(productId);
    // if (!product) {
    //   throw new NotFoundException('Sản phẩm không tồn tại');
    // }
    // if (product.stock < quantity) {
    //   throw new BadRequestException(`Chỉ còn ${product.stock} sản phẩm trong kho`);
    // }

    // Check existing cart item
    const existingItem = await this.cartRepository.findOne({
      where: { 
        userId: new ObjectId(userId), 
        productId: new ObjectId(productId) 
      }
    });

    if (existingItem) {
      // Update existing item
      const newQuantity = existingItem.quantity + quantity;
      
      if (newQuantity > 3) {
        throw new BadRequestException('Chỉ được thêm tối đa 3 sản phẩm cùng loại');
      }

      const result = await this.cartRepository.findOneAndUpdate(
        { _id: existingItem.id },
        { 
          $set: { 
            quantity: newQuantity,
            updatedAt: new Date()
          } 
        },
        { returnDocument: 'after' }
      );

      if (!result?.value) {
        throw new NotFoundException('Không thể cập nhật giỏ hàng');
      }

      return result.value;
    } else {
      // Create new cart item
      const cartItem = this.cartRepository.create({
        userId: new ObjectId(userId),
        productId: new ObjectId(productId),
        quantity
      });

      return this.cartRepository.save(cartItem);
    }
  }

  // ✅ Tăng số lượng sản phẩm
  async increaseQuantity(userId: string, cartItemId: string): Promise<CartItem> {
    const cartItem = await this.cartRepository.findOne({
      where: { 
        _id: new ObjectId(cartItemId),
        userId: new ObjectId(userId)
      }
    });

    if (!cartItem) {
      throw new NotFoundException('Sản phẩm không có trong giỏ hàng');
    }

    if (cartItem.quantity >= 3) {
      throw new BadRequestException('Chỉ được thêm tối đa 3 sản phẩm cùng loại');
    }

    // TODO: Validate stock
    // const product = await this.productService.findOne(cartItem.productId.toString());
    // if (product.stock < cartItem.quantity + 1) {
    //   throw new BadRequestException(`Chỉ còn ${product.stock} sản phẩm trong kho`);
    // }

    const result = await this.cartRepository.findOneAndUpdate(
      { _id: new ObjectId(cartItemId) },
      { 
        $set: { 
          quantity: cartItem.quantity + 1,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result?.value) {
      throw new NotFoundException('Không thể cập nhật giỏ hàng');
    }

    return result.value;
  }

  // ✅ Giảm số lượng sản phẩm
  async decreaseQuantity(userId: string, cartItemId: string): Promise<CartItem | { removed: boolean; cartItemId: string }> {
    const cartItem = await this.cartRepository.findOne({
      where: { 
        _id: new ObjectId(cartItemId),
        userId: new ObjectId(userId)
      }
    });

    if (!cartItem) {
      throw new NotFoundException('Sản phẩm không có trong giỏ hàng');
    }

    if (cartItem.quantity <= 1) {
      // Remove item if quantity would be 0
      await this.cartRepository.deleteOne({ _id: new ObjectId(cartItemId) });
      return { removed: true, cartItemId };
    }

    const result = await this.cartRepository.findOneAndUpdate(
      { _id: new ObjectId(cartItemId) },
      { 
        $set: { 
          quantity: cartItem.quantity - 1,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result?.value) {
      throw new NotFoundException('Không thể cập nhật giỏ hàng');
    }

    return result.value;
  }

  // ✅ Xóa sản phẩm khỏi giỏ hàng
  async removeFromCart(userId: string, cartItemId: string): Promise<{ removed: boolean; cartItemId: string }> {
    const result = await this.cartRepository.deleteOne({
      _id: new ObjectId(cartItemId),
      userId: new ObjectId(userId)
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Sản phẩm không có trong giỏ hàng');
    }

    return { removed: true, cartItemId };
  }

  // ✅ Lấy giỏ hàng
  async getCart(userId: string): Promise<{
    cartItems: CartItem[];
    totalItems: number;
    count: number;
  }> {
    const cartItems = await this.cartRepository.find({
      where: { userId: new ObjectId(userId) },
      order: { addedAt: 'DESC' }
    });

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      cartItems,
      totalItems,
      count: cartItems.length
    };
  }

  // ✅ Xóa toàn bộ giỏ hàng
  async clearCart(userId: string): Promise<{ deletedCount: number }> {
    const result = await this.cartRepository.deleteMany({
      userId: new ObjectId(userId)
    });

    return { deletedCount: result.deletedCount || 0 };
  }

  // ✅ Validate giỏ hàng trước khi thanh toán
  async validateCart(userId: string): Promise<{
    cartItems: CartItem[];
    totalItems: number;
    isValid: boolean;
  }> {
    const cartItems = await this.cartRepository.find({
      where: { userId: new ObjectId(userId) }
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Giỏ hàng trống');
    }

    // TODO: Validate stock for each item
    // const stockValidation = [];
    // for (const cartItem of cartItems) {
    //   const product = await this.productService.findOne(cartItem.productId.toString());
    //   if (product.stock < cartItem.quantity) {
    //     stockValidation.push({
    //       cartItemId: cartItem.id,
    //       productId: cartItem.productId,
    //       productName: product.name,
    //       requested: cartItem.quantity,
    //       available: product.stock
    //     });
    //   }
    // }

    // if (stockValidation.length > 0) {
    //   throw new BadRequestException('Một số sản phẩm không đủ hàng');
    // }

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      cartItems,
      totalItems,
      isValid: true
    };
  }

  // ✅ Get cart count
  async getCartCount(userId: string): Promise<number> {
    return this.cartRepository.count({
      where: { userId: new ObjectId(userId) }
    });
  }

  // ✅ Check if product in cart
  async isProductInCart(userId: string, productId: string): Promise<boolean> {
    const cartItem = await this.cartRepository.findOne({
      where: {
        userId: new ObjectId(userId),
        productId: new ObjectId(productId)
      }
    });

    return !!cartItem;
  }
}