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
    // @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
        try {
            const userId = req.user.sub || req.user.userId;
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

    // 📋 Lấy danh sách đơn hàng
    @UseGuards(JwtAuthGuard)
    @Get()
    async findAll(
        @Request() req,
        @Query('all') all?: string
    ) {
        try {
            const isAdmin = req.user.role === 'admin';
            const userId = isAdmin && all === 'true' ? undefined : (req.user.sub || req.user.userId);

            const orders = await this.orderService.findAll(userId);

            return {
                success: true,
                message: 'Lấy danh sách đơn hàng thành công',
                data: orders
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Lấy danh sách đơn hàng thất bại',
                data: null
            };
        }
    }

    // 🔍 Lấy chi tiết đơn hàng
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

    // ✏️ Cập nhật đơn hàng (Admin only)
    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles('admin')
    @UseGuards(JwtAuthGuard)
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

    // ❌ Hủy đơn hàng
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
}