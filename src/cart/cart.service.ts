// import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { ObjectId } from 'mongodb';
// import { MongoRepository } from 'typeorm';
// import { CartItem } from './entities/cart.entity';
// import { CreateCartDto } from './dto/create-cart.dto';
// import { UpdateCartDto } from './dto/update-cart.dto';
// import { ProductsService } from '../products/products.service';

// @Injectable()
// export class CartService {
//     constructor(
//         @InjectRepository(CartItem)
//         private cartRepository: MongoRepository<CartItem>,

//         @Inject(forwardRef(() => ProductsService))
//         private productsService: ProductsService
//     ) { }

//     async addToCart(userId: string, createCartDto: CreateCartDto): Promise<CartItem> {
//         const { productId, quantity = 1 } = createCartDto;

//         // ✅ Đảm bảo quantity là số
//         const numQuantity = Number(quantity);

//         console.log('⚡️ Adding to cart:', { userId, productId, quantity: numQuantity });

//         try {
//             const userObjId = new ObjectId(userId);
//             const productObjId = new ObjectId(productId);
//             console.log('ObjectIds:', { userObjId, productObjId });
//         } catch (error) {
//             console.error('❌ Invalid ObjectId:', error);
//             throw new BadRequestException('ID không hợp lệ');
//         }

//         // Kiểm tra số lượng từ 1 đến 3
//         if (numQuantity < 1 || numQuantity > 3 || isNaN(numQuantity)) {
//             throw new BadRequestException('Số lượng phải từ 1 đến 3');
//         }

//         try {
//             const product = await this.productsService.findOne(productId);
//             if (!product) {
//                 throw new NotFoundException('Sản phẩm không tồn tại');
//             }

//             if (product.stock < numQuantity) {
//                 throw new BadRequestException(`Chỉ còn ${product.stock} sản phẩm trong kho`);
//             }
//         } catch (error) {
//             if (error instanceof BadRequestException || error instanceof NotFoundException) {
//                 throw error;
//             }
//             throw new NotFoundException('Sản phẩm không tồn tại');
//         }

//         // Kiểm tra số lượng mặt hàng trong giỏ (tối đa 50 mặt hàng)
//         const currentCartCount = await this.cartRepository.count({
//             where: { userId: new ObjectId(userId) }
//         });

//         const existingItem = await this.cartRepository.findOne({
//             where: {
//                 userId: new ObjectId(userId),
//                 productId: new ObjectId(productId)
//             }
//         });

//         if (existingItem) {
//             // Nếu sản phẩm đã có trong giỏ, cộng dồn số lượng (tối đa 3)
//             const newQuantity = Number(existingItem.quantity) + numQuantity;

//             if (newQuantity > 3) {
//                 throw new BadRequestException('Mỗi mặt hàng chỉ được thêm tối đa 3 sản phẩm');
//             }

//             const product = await this.productsService.findOne(productId);
//             if (product.stock < newQuantity) {
//                 throw new BadRequestException(`Chỉ còn ${product.stock} sản phẩm trong kho`);
//             }

//             existingItem.quantity = newQuantity;
//             existingItem.updatedAt = new Date();

//             return await this.cartRepository.save(existingItem);
//         } else {
//             // Nếu chưa có sản phẩm này, kiểm tra số lượng mặt hàng trong giỏ
//             if (currentCartCount >= 50) {
//                 throw new BadRequestException('Giỏ hàng chỉ được chứa tối đa 50 mặt hàng khác nhau');
//             }
//             const cartItem = this.cartRepository.create({
//                 userId: new ObjectId(userId),
//                 productId: new ObjectId(productId),
//                 quantity: numQuantity,
//                 addedAt: new Date(),
//                 updatedAt: new Date()
//             });

//             return this.cartRepository.save(cartItem);
//         }
//     }

//     async increaseQuantity(userId: string, productId: string): Promise<CartItem> {
//         // Validate ObjectId
//         try {
//             new ObjectId(userId);
//             new ObjectId(productId);
//         } catch (error) {
//             throw new BadRequestException('ID không hợp lệ');
//         }

//         // Tìm cart item theo userId và productId
//         const cartItem = await this.cartRepository.findOne({
//             where: {
//                 userId: new ObjectId(userId),
//                 productId: new ObjectId(productId)
//             }
//         });

//         if (!cartItem) {
//             throw new NotFoundException('Sản phẩm không có trong giỏ hàng');
//         }

//         // ✅ Đảm bảo quantity là số
//         const currentQuantity = Number(cartItem.quantity);

//         // Kiểm tra tối đa 3 sản phẩm cho mỗi mặt hàng
//         if (currentQuantity >= 3) {
//             throw new BadRequestException('Mỗi mặt hàng chỉ được thêm tối đa 3 sản phẩm');
//         }

//         cartItem.quantity = currentQuantity + 1;
//         cartItem.updatedAt = new Date();

//         return await this.cartRepository.save(cartItem);
//     }

//     async decreaseQuantity(userId: string, productId: string): Promise<CartItem | { removed: boolean; productId: string }> {
//         try {
//             new ObjectId(userId);
//             new ObjectId(productId);
//         } catch (error) {
//             throw new BadRequestException('ID không hợp lệ');
//         }

//         const cartItem = await this.cartRepository.findOne({
//             where: {
//                 userId: new ObjectId(userId),
//                 productId: new ObjectId(productId)
//             }
//         });

//         if (!cartItem) {
//             throw new NotFoundException('Sản phẩm không có trong giỏ hàng');
//         }

//         if (cartItem.quantity <= 1) {
//             await this.cartRepository.deleteOne({
//                 userId: new ObjectId(userId),
//                 productId: new ObjectId(productId)
//             });
//             return { removed: true, productId };
//         }

//         cartItem.quantity -= 1;
//         cartItem.updatedAt = new Date();

//         return await this.cartRepository.save(cartItem);
//     }

//     async removeFromCart(userId: string, productId: string): Promise<{ removed: boolean; productId: string }> {
//         const result = await this.cartRepository.deleteOne({
//             userId: new ObjectId(userId),
//             productId: new ObjectId(productId)
//         });

//         if (result.deletedCount === 0) {
//             throw new NotFoundException('Sản phẩm không có trong giỏ hàng');
//         }

//         return { removed: true, productId };
//     }

//     async getCart(userId: string): Promise<{
//         cartItems: any[];
//         totalItems: number;
//         count: number;
//     }> {
//         const cartItems = await this.cartRepository.find({
//             where: { userId: new ObjectId(userId) },
//             order: { addedAt: 'DESC' }
//         });

//         const populatedCartItems: any[] = [];

//         for (const item of cartItems) {
//             try {
//                 const product = await this.productsService.findOne(item.productId.toString());

//                 const cartItemWithProduct = {
//                     // ✅ SỬA: Đảm bảo _id được trả về đúng format
//                     _id: (item as any)._id?.toString() || (item as any).id?.toString(),
//                     id: (item as any)._id?.toString() || (item as any).id?.toString(),
//                     userId: item.userId,
//                     productId: item.productId,
//                     quantity: item.quantity,
//                     addedAt: item.addedAt,
//                     updatedAt: item.updatedAt,

//                     product: {
//                         id: (product as any)._id?.toString() || (product as any).id?.toString() || 'unknown',
//                         name: product.name || 'Tên sản phẩm không xác định',
//                         price: product.price || 0,
//                         imageUrl: Array.isArray(product.imageUrls) && product.imageUrls.length > 0
//                             ? product.imageUrls[0]
//                             : (product as any).image || '/placeholder.jpg',
//                         stock: product.stock || 0,
//                         category: (product as any).categoryId || 'Không xác định',
//                         description: product.description || ''
//                     },

//                     totalPrice: product.price * item.quantity
//                 };

//                 populatedCartItems.push(cartItemWithProduct);
//             } catch (error) {
//                 console.error(`❌ Error fetching product ${item.productId}:`, error);

//                 populatedCartItems.push({
//                     // ✅ SỬA: Đảm bảo _id được trả về đúng format
//                     _id: (item as any)._id?.toString() || (item as any).id?.toString(),
//                     id: (item as any)._id?.toString() || (item as any).id?.toString(),
//                     userId: item.userId,
//                     productId: item.productId,
//                     quantity: item.quantity,
//                     addedAt: item.addedAt,
//                     updatedAt: item.updatedAt,
//                     product: {
//                         id: item.productId,
//                         name: 'Sản phẩm không tồn tại',
//                         price: 0,
//                         imageUrl: '/placeholder.jpg',
//                         stock: 0,
//                         category: 'Không xác định',
//                         description: 'Sản phẩm này có thể đã bị xóa'
//                     },
//                     totalPrice: 0
//                 });
//             }
//         }

//         const totalItems = populatedCartItems.reduce((sum, item) => sum + item.quantity, 0);

//         return {
//             cartItems: populatedCartItems,
//             totalItems,
//             count: populatedCartItems.length
//         };
//     }

//     async clearCart(userId: string): Promise<{ deletedCount: number }> {
//         const result = await this.cartRepository.deleteMany({
//             userId: new ObjectId(userId)
//         });

//         return { deletedCount: result.deletedCount || 0 };
//     }

//     async validateCart(userId: string): Promise<{
//         cartItems: CartItem[];
//         totalItems: number;
//         isValid: boolean;
//     }> {
//         const cartItems = await this.cartRepository.find({
//             where: { userId: new ObjectId(userId) }
//         });

//         if (cartItems.length === 0) {
//             throw new BadRequestException('Giỏ hàng trống');
//         }

//         const stockValidation: any[] = [];
//         for (const cartItem of cartItems) {
//             try {
//                 const product = await this.productsService.findOne(cartItem.productId.toString());
//                 if (product.stock < cartItem.quantity) {
//                     stockValidation.push({
//                         cartItemId: (cartItem as any)._id,
//                         productId: cartItem.productId,
//                         productName: product.name,
//                         requested: cartItem.quantity,
//                         available: product.stock
//                     });
//                 }
//             } catch (error) {
//                 console.error(`Error validating product ${cartItem.productId}:`, error);
//                 stockValidation.push({
//                     cartItemId: (cartItem as any)._id,
//                     productId: cartItem.productId,
//                     productName: 'Sản phẩm không tồn tại',
//                     requested: cartItem.quantity,
//                     available: 0
//                 });
//             }
//         }

//         if (stockValidation.length > 0) {
//             throw new BadRequestException({
//                 message: 'Một số sản phẩm không đủ hàng hoặc không tồn tại',
//                 invalidItems: stockValidation
//             });
//         }

//         const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

//         return {
//             cartItems,
//             totalItems,
//             isValid: true
//         };
//     }

//     async getCartCount(userId: string): Promise<number> {
//         return this.cartRepository.count({
//             where: { userId: new ObjectId(userId) }
//         });
//     }

//     async isProductInCart(userId: string, productId: string): Promise<boolean> {
//         const cartItem = await this.cartRepository.findOne({
//             where: {
//                 userId: new ObjectId(userId),
//                 productId: new ObjectId(productId)
//             }
//         });

//         return !!cartItem;
//     }
// }