import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Request,
    HttpCode,
    HttpStatus,
    UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { ObjectId } from 'mongodb';

@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) {}

    // ✅ Thêm sản phẩm vào giỏ hàng (yêu cầu đăng nhập)
    @UseGuards(AuthGuard('jwt'))
    @Post('add')
    @HttpCode(HttpStatus.OK)
    async addToCart(@Request() req: any, @Body() createCartDto: CreateCartDto) {
        // Lấy userId từ JWT token
        const userId = req.user?.sub;
        if (!userId) {
            return {
                success: false,
                message: 'Bạn chưa đăng nhập',
                data: null
            };
        }

        const cartItem = await this.cartService.addToCart(userId, createCartDto);

        return {
            success: true,
            message: 'Đã thêm vào giỏ hàng',
            data: { cartItem }
        };
    }

    // ✅ THÊM route tăng số lượng
    @Put('increase/:cartItemId')
    async increaseQuantity(
        @Param('cartItemId') cartItemId: string,
        @Request() req: any
    ) {
        try {
            // Validate ObjectId
            if (!ObjectId.isValid(cartItemId)) {
                return {
                    success: false,
                    message: 'Cart Item ID không hợp lệ',
                    data: null
                };
            }

            const userId = req.user?.userId || req.user?.id || '507f1f77bcf86cd799439011';
            
            console.log('🔍 Increase quantity:', { userId, cartItemId });
            
            const result = await this.cartService.increaseQuantity(userId, cartItemId);
            
            return {
                success: true,
                message: 'Tăng số lượng thành công',
                data: {
                    cartItem: result
                }
            };
        } catch (error) {
            console.error('❌ Error in increaseQuantity:', error);
            return {
                success: false,
                message: error.message,
                data: null
            };
        }
    }

    // ✅ THÊM route giảm số lượng
    @Put('decrease/:cartItemId')
    async decreaseQuantity(
        @Param('cartItemId') cartItemId: string,
        @Request() req: any
    ) {
        try {
            // Validate ObjectId
            if (!ObjectId.isValid(cartItemId)) {
                return {
                    success: false,
                    message: 'Cart Item ID không hợp lệ',
                    data: null
                };
            }

            const userId = req.user?.userId || req.user?.id || '507f1f77bcf86cd799439011';
            
            console.log('🔍 Decrease quantity:', { userId, cartItemId });
            
            const result = await this.cartService.decreaseQuantity(userId, cartItemId);
            
            return {
                success: true,
                message: 'Giảm số lượng thành công',
                data: result.hasOwnProperty('removed') ? result : { cartItem: result }
            };
        } catch (error) {
            console.error('❌ Error in decreaseQuantity:', error);
            return {
                success: false,
                message: error.message,
                data: null
            };
        }
    }

    // ✅ THÊM route xóa sản phẩm (nếu chưa có)
    @Delete('remove/:cartItemId')
    async removeFromCart(
        @Param('cartItemId') cartItemId: string,
        @Request() req: any
    ) {
        try {
            // Validate ObjectId
            if (!ObjectId.isValid(cartItemId)) {
                return {
                    success: false,
                    message: 'Cart Item ID không hợp lệ',
                    data: null
                };
            }

            const userId = req.user?.userId || req.user?.id || '507f1f77bcf86cd799439011';
            
            console.log('🔍 Remove from cart:', { userId, cartItemId });
            
            const result = await this.cartService.removeFromCart(userId, cartItemId);
            
            return {
                success: true,
                message: 'Xóa sản phẩm thành công',
                data: result
            };
        } catch (error) {
            console.error('❌ Error in removeFromCart:', error);
            return {
                success: false,
                message: error.message,
                data: null
            };
        }
    }

    // ✅ Lấy giỏ hàng
    @Get()
    async getCart(@Request() req: any) {
        const userId = req.user?.id || '507f1f77bcf86cd799439011'; // Mock user ID for testing

        const cartData = await this.cartService.getCart(userId);

        return {
            success: true,
            message: 'Lấy giỏ hàng thành công',
            data: cartData
        };
    }

    // ✅ Xóa toàn bộ giỏ hàng
    @Delete('clear')
    async clearCart(@Request() req: any) {
        const userId = req.user?.id || '507f1f77bcf86cd799439011'; // Mock user ID for testing

        const result = await this.cartService.clearCart(userId);

        return {
            success: true,
            message: 'Đã xóa toàn bộ giỏ hàng',
            data: result
        };
    }

    // ✅ Validate giỏ hàng trước khi thanh toán
    @Get('validate')
    async validateCart(@Request() req: any) {
        const userId = req.user?.id || '507f1f77bcf86cd799439011'; // Mock user ID for testing

        const result = await this.cartService.validateCart(userId);

        return {
            success: true,
            message: 'Giỏ hàng hợp lệ',
            data: result
        };
    }

    // ✅ Get cart count
    @Get('count')
    async getCartCount(@Request() req: any) {
        const userId = req.user?.id || '507f1f77bcf86cd799439011'; // Mock user ID for testing

        const count = await this.cartService.getCartCount(userId);

        return {
            success: true,
            message: 'Lấy số lượng giỏ hàng thành công',
            data: { count }
        };
    }

    // ✅ Check if product in cart
    @Get('check/:productId')
    async isProductInCart(@Request() req: any, @Param('productId') productId: string) {
        const userId = req.user?.id || '507f1f77bcf86cd799439011'; // Mock user ID for testing

        const inCart = await this.cartService.isProductInCart(userId, productId);

        return {
            success: true,
            message: 'Kiểm tra sản phẩm trong giỏ hàng thành công',
            data: { inCart }
        };
    }
}