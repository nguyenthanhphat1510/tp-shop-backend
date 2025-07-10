import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  Put,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // TODO: Implement auth guard

@Controller('cart')
// @UseGuards(JwtAuthGuard) // TODO: Uncomment when auth guard is ready
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // ✅ Thêm sản phẩm vào giỏ hàng
  @Post('add')
  @HttpCode(HttpStatus.OK)
  async addToCart(@Request() req: any, @Body() createCartDto: CreateCartDto) {
    // TODO: Get userId from JWT token
    const userId = req.user?.id || '507f1f77bcf86cd799439011'; // Mock user ID for testing
    
    const cartItem = await this.cartService.addToCart(userId, createCartDto);
    
    return {
      success: true,
      message: 'Đã thêm vào giỏ hàng',
      data: { cartItem }
    };
  }

  // ✅ Tăng số lượng sản phẩm
  @Put('increase/:cartItemId')
  async increaseQuantity(@Request() req: any, @Param('cartItemId') cartItemId: string) {
    const userId = req.user?.id || '507f1f77bcf86cd799439011'; // Mock user ID for testing
    
    const cartItem = await this.cartService.increaseQuantity(userId, cartItemId);
    
    return {
      success: true,
      message: 'Đã tăng số lượng',
      data: { cartItem }
    };
  }

  // ✅ Giảm số lượng sản phẩm
  @Put('decrease/:cartItemId')
  async decreaseQuantity(@Request() req: any, @Param('cartItemId') cartItemId: string) {
    const userId = req.user?.id || '507f1f77bcf86cd799439011'; // Mock user ID for testing
    
    const result = await this.cartService.decreaseQuantity(userId, cartItemId);
    
    if ('removed' in result) {
      return {
        success: true,
        message: 'Đã xóa sản phẩm khỏi giỏ hàng',
        data: result
      };
    }
    
    return {
      success: true,
      message: 'Đã giảm số lượng',
      data: { cartItem: result }
    };
  }

  // ✅ Xóa sản phẩm khỏi giỏ hàng
  @Delete('remove/:cartItemId')
  async removeFromCart(@Request() req: any, @Param('cartItemId') cartItemId: string) {
    const userId = req.user?.id || '507f1f77bcf86cd799439011'; // Mock user ID for testing
    
    const result = await this.cartService.removeFromCart(userId, cartItemId);
    
    return {
      success: true,
      message: 'Đã xóa sản phẩm khỏi giỏ hàng',
      data: result
    };
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