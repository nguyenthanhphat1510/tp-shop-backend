import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

@Controller('orders')
export class OrderController {
    constructor(private readonly orderService: OrderService) { }

    // 🆕 Tạo đơn hàng mới
    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
        const userId = req.user?.id;
        if (!userId) {
            return {
                success: false,
                message: 'Bạn chưa đăng nhập',
                data: null
            };
        }
        try {
            const order = await this.orderService.create(userId, createOrderDto);

            return {
                success: true,
                message: 'Đặt hàng thành công',
                data: order
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Đặt hàng thất bại',
                data: null
            };
        }
    }

    // 📋 Lấy danh sách đơn hàng (CÓ PHÂN QUYỀN)
    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll(
        @Request() req,
        @Query('all') all?: string
    ) {
        try {
            console.log('🔍 JWT User payload:', req.user);

            const isAdmin = req.user.role === 'admin';
            const userId = isAdmin && all === 'true' ? undefined : req.user.id;

            console.log('🔍 Getting orders for userId:', userId);

            if (!userId && !isAdmin) {
                return {
                    success: false,
                    message: 'Unauthorized - User ID not found',
                    data: null
                };
            }

            const orders = await this.orderService.findAll();

            return {
                success: true,
                message: 'Lấy danh sách đơn hàng thành công',
                data: orders
            };
        } catch (error) {
            console.error('❌ Error in findAll orders:', error);
            return {
                success: false,
                message: error.message || 'Lấy danh sách đơn hàng thất bại',
                data: null
            };
        }
    }

    // ✅ API ADMIN - Lấy tất cả đơn hàng KHÔNG CẦN PHÂN QUYỀN
    @Get('admin/all')
    async findAllForAdmin() {
        try {
            console.log('🔍 Getting all orders for admin without authentication');

            // ✅ Lấy tất cả orders không cần userId
            const orders = await this.orderService.findAll();

            return {
                success: true,
                message: 'Lấy danh sách đơn hàng thành công',
                data: orders
            };
        } catch (error) {
            console.error('❌ Error in findAllForAdmin orders:', error);
            return {
                success: false,
                message: error.message || 'Lấy danh sách đơn hàng thất bại',
                data: null
            };
        }
    }

    // 🔍 Lấy chi tiết đơn hàng (CÓ PHÂN QUYỀN)
    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async findOne(@Param('id') id: string, @Request() req) {
        try {
            const isAdmin = req.user.role === 'admin';
            const userId = isAdmin ? undefined : (req.user.sub || req.user.userId);

            const order = await this.orderService.findOneWithItems(id, userId);

            return {
                success: true,
                message: 'Lấy chi tiết đơn hàng thành công',
                data: order
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Lấy chi tiết đơn hàng thất bại',
                data: null
            };
        }
    }

    // ✅ API ADMIN - Lấy chi tiết đơn hàng KHÔNG CẦN PHÂN QUYỀN
    @Get('admin/:id')
    async findOneForAdmin(@Param('id') id: string) {
        try {
            console.log('🔍 Getting order details for admin:', id);

            // ✅ Lấy chi tiết order không cần userId
            const order = await this.orderService.findOneWithItems(id);

            return {
                success: true,
                message: 'Lấy chi tiết đơn hàng thành công',
                data: order
            };
        } catch (error) {
            console.error('❌ Error in findOneForAdmin:', error);
            return {
                success: false,
                message: error.message || 'Lấy chi tiết đơn hàng thất bại',
                data: null
            };
        }
    }

    // ✏️ Cập nhật đơn hàng (CÓ PHÂN QUYỀN)
    @Patch(':id')
    async update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
        try {
            const order = await this.orderService.update(id, updateOrderDto);

            return {
                success: true,
                message: 'Cập nhật đơn hàng thành công',
                data: order
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Cập nhật đơn hàng thất bại',
                data: null
            };
        }
    }

    // ✅ API ADMIN - Cập nhật đơn hàng KHÔNG CẦN PHÂN QUYỀN
    @Patch('admin/:id')
    async updateForAdmin(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
        try {
            console.log('🔄 Admin updating order:', id, updateOrderDto);
            const order = await this.orderService.update(id, updateOrderDto);

            return {
                success: true,
                message: 'Cập nhật đơn hàng thành công',
                data: order
            };
        } catch (error) {
            console.error('❌ Error in updateForAdmin:', error);
            return {
                success: false,
                message: error.message || 'Cập nhật đơn hàng thất bại',
                data: null
            };
        }
    }

    // ❌ Hủy đơn hàng (CÓ PHÂN QUYỀN)
    @UseGuards(JwtAuthGuard)
    @Patch(':id/cancel')
    async cancel(
        @Param('id') id: string,
        @Request() req,
        @Body('reason') reason?: string
    ) {
        try {
            const userId = req.user.sub || req.user.userId;
            const order = await this.orderService.cancel(id, userId, reason);

            return {
                success: true,
                message: 'Hủy đơn hàng thành công',
                data: order
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Hủy đơn hàng thất bại',
                data: null
            };
        }
    }

    // ✅ API ADMIN - Hủy đơn hàng KHÔNG CẦN PHÂN QUYỀN
    @Patch('admin/:id/cancel')
    async cancelForAdmin(
        @Param('id') id: string,
        @Body('reason') reason?: string
    ) {
        try {
            console.log('🔄 Admin cancelling order:', id, 'reason:', reason);
            const order = await this.orderService.cancel(id, reason || 'Hủy bởi admin');

            return {
                success: true,
                message: 'Hủy đơn hàng thành công',
                data: order
            };
        } catch (error) {
            console.error('❌ Error in cancelForAdmin:', error);
            return {
                success: false,
                message: error.message || 'Hủy đơn hàng thất bại',
                data: null
            };
        }
    }
}