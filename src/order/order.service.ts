import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Order, OrderStatus, PaymentStatus } from './entities/order.entity';
import { OrderItem, OrderItemStatus } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private cartService: CartService,
    private productsService: ProductsService,
  ) {}

  // 🆕 Tạo đơn hàng mới
  async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      let orderItems: OrderItem[] = [];

      // Tạo từ cart hiện tại
      if (createOrderDto.createFromCart || !createOrderDto.items) {
        orderItems = await this.createOrderItemsFromCart(userId);
      } else {
        // Tạo từ items cụ thể (buy now)
        orderItems = await this.createOrderItemsFromRequest(createOrderDto.items);
      }

      if (orderItems.length === 0) {
        throw new BadRequestException('Không có sản phẩm nào để đặt hàng');
      }

      // Tính toán giá
      const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
      const shippingFee = this.calculateShippingFee(createOrderDto.shippingInfo.city);
      const total = subtotal + shippingFee;

      // Tạo order
      const orderNumber = await this.generateOrderNumber();
      
      const order = this.orderRepository.create({
        orderNumber,
        userId: new ObjectId(userId),
        shippingInfo: createOrderDto.shippingInfo,
        paymentMethod: createOrderDto.paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        subtotal,
        shippingFee,
        discount: 0,
        total,
        status: OrderStatus.PENDING,
        note: createOrderDto.note,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedOrder = await this.orderRepository.save(order);

      // Lưu order items
      for (const item of orderItems) {
        item.orderId = savedOrder._id;
        await this.orderItemRepository.save(item);
      }

      // Xóa cart nếu tạo từ cart
      if (createOrderDto.createFromCart || !createOrderDto.items) {
        await this.cartService.clearCart(userId);
      }

      // Trả về order với items
      return await this.findOneWithItems(savedOrder.id);

    } catch (error) {
      throw new BadRequestException(error.message || 'Không thể tạo đơn hàng');
    }
  }

  // 📋 Lấy danh sách đơn hàng
  async findAll(userId?: string): Promise<Order[]> {
    const where = userId ? { userId: new ObjectId(userId) } : {};
    
    return await this.orderRepository.find({
      where,
      order: { createdAt: 'DESC' }
    });
  }

  // 🔍 Lấy chi tiết đơn hàng
  async findOne(id: string, userId?: string): Promise<Order> {
    const where: any = { _id: new ObjectId(id) };
    if (userId) {
      where.userId = new ObjectId(userId);
    }

    const order = await this.orderRepository.findOne({ where });
    
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return order;
  }

  // 🔍 Lấy đơn hàng với items
  async findOneWithItems(id: string, userId?: string): Promise<Order> {
    const order = await this.findOne(id, userId);
    
    // Load order items
    const orderItems = await this.orderItemRepository.find({
      where: { orderId: order._id }
    });

    (order as any).orderItems = orderItems;
    return order;
  }

  // ✏️ Cập nhật đơn hàng (Admin only)
  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);

    Object.assign(order, updateOrderDto);
    order.updatedAt = new Date();

    return await this.orderRepository.save(order);
  }

  // ❌ Hủy đơn hàng
  async cancel(id: string, userId: string, reason?: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    if (!order.isCancellable) {
      throw new BadRequestException('Không thể hủy đơn hàng này');
    }

    order.status = OrderStatus.CANCELLED;
    order.note = reason || order.note;
    order.updatedAt = new Date();

    return await this.orderRepository.save(order);
  }

  // ===== HELPER METHODS =====

  private async createOrderItemsFromCart(userId: string): Promise<OrderItem[]> {
    const cart = await this.cartService.getCart(userId);
    
    if (!cart.cartItems || cart.cartItems.length === 0) {
      throw new BadRequestException('Giỏ hàng trống');
    }

    const orderItems: OrderItem[] = [];

    for (const cartItem of cart.cartItems) {
      const product = await this.productsService.findOne(cartItem.productId.toString());
      
      if (!product) {
        throw new BadRequestException(`Sản phẩm ${cartItem.productId} không tồn tại`);
      }

      if (product.stock < cartItem.quantity) {
        throw new BadRequestException(`Sản phẩm ${product.name} chỉ còn ${product.stock} trong kho`);
      }

      const subtotal = product.price * cartItem.quantity;

      const orderItem = this.orderItemRepository.create({
        productId: cartItem.productId,
        productName: product.name,
        productImageUrl: Array.isArray(product.imageUrls) && product.imageUrls.length > 0
          ? product.imageUrls[0]
          : '/placeholder.jpg',
        unitPrice: product.price,
        quantity: cartItem.quantity,
        subtotal,
        status: OrderItemStatus.ACTIVE
      });

      orderItems.push(orderItem);
    }

    return orderItems;
  }

  private async createOrderItemsFromRequest(items: any[]): Promise<OrderItem[]> {
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      const product = await this.productsService.findOne(item.productId);
      
      if (!product) {
        throw new BadRequestException(`Sản phẩm ${item.productId} không tồn tại`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(`Sản phẩm ${product.name} chỉ còn ${product.stock} trong kho`);
      }

      const subtotal = product.price * item.quantity;

      const orderItem = this.orderItemRepository.create({
        productId: new ObjectId(item.productId),
        productName: product.name,
        productImageUrl: Array.isArray(product.imageUrls) && product.imageUrls.length > 0
          ? product.imageUrls[0]
          : '/placeholder.jpg',
        unitPrice: product.price,
        quantity: item.quantity,
        subtotal,
        status: OrderItemStatus.ACTIVE
      });

      orderItems.push(orderItem);
    }

    return orderItems;
  }

  private calculateShippingFee(city: string): number {
    const freeShippingCities = ['Hồ Chí Minh', 'Hà Nội'];
    return freeShippingCities.includes(city) ? 0 : 30000;
  }

  private async generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // 🔧 Tạo unique ID với timestamp
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  
  return `ORD-${dateStr}-${timestamp.toString().slice(-6)}${randomSuffix}`;
}
}