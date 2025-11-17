import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Order, OrderStatus, PaymentStatus } from './entities/order.entity';
import { OrderItem, OrderItemStatus } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrderService {
    constructor(
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        @InjectRepository(OrderItem)
        private orderItemRepository: Repository<OrderItem>,
        private productsService: ProductsService,
    ) { }

    /**
     * 🆕 TẠO ĐƠN HÀNG MỚI
     * 
     * VÍ DỤ INPUT:
     * userId = "670123456789abcdef123456"
     * createOrderDto = {
     *   "shippingInfo": {
     *     "fullName": "Nguyễn Văn A",
     *     "email": "user@example.com",
     *     "phone": "0123456789",
     *     "address": "123 Đường ABC",
     *     "city": "Hồ Chí Minh",
     *     "district": "Quận 1",
     *     "ward": "Phường Bến Nghé"
     *   },
     *   "paymentMethod": "COD",
     *   "note": "Giao hàng buổi chiều",
     *   "items": [
     *     {
     *       "productId": "64abc123def456789",
     *       "variantId": "64abc123def456790",
     *       "quantity": 2
     *     },
     *     {
     *       "productId": "64abc123def456791",
     *       "variantId": "64abc123def456792", 
     *       "quantity": 1
     *     }
     *   ]
     * }
     *
     * VÍ DỤ OUTPUT:
     * {
     *   "_id": "671234567890abcdef123456",
     *   "orderNumber": "ORD-20241001-123456",
     *   "total": 75030000,
     *   "orderItems": [
     *     {
     *       "productName": "iPhone 15 Pro (256GB - Vàng)",
     *       "unitPrice": 25000000,
     *       "quantity": 2,
     *       "subtotal": 50000000
     *     },
     *     {
     *       "productName": "Samsung Galaxy S24 (128GB - Đen)",
     *       "unitPrice": 25000000,
     *       "quantity": 1,
     *       "subtotal": 25000000
     *     }
     *   ]
     * }
     */
    async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
        try {
            // 🔍 BƯỚC 1: VALIDATE - Kiểm tra có sản phẩm nào để đặt hàng không
            if (!createOrderDto.items || createOrderDto.items.length === 0) {
                throw new BadRequestException('Không có sản phẩm nào để đặt hàng');
            }

            console.log('🛒 Creating order with items:', createOrderDto.items);

            // 🔍 BƯỚC 2: TẠO ORDER ITEMS - Chuyển đổi từ frontend data sang database format
            const orderItems = await this.createOrderItemsFromRequest(createOrderDto.items);
            console.log('📦 Created order items:', orderItems.length);

            // 🔍 BƯỚC 3: TRỪ STOCK - Giảm số lượng tồn kho cho từng variant
            for (const item of createOrderDto.items) {
                // ✅ VALIDATE variantId trước khi gọi decreaseVariantStock
                if (!item.variantId) {
                    throw new BadRequestException(`Thiếu variantId cho sản phẩm ${item.productId}`);
                }

                console.log(`📉 Decreasing stock for variant: ${item.variantId}, quantity: ${item.quantity}`);
                
                // ✅ Bây giờ TypeScript biết item.variantId không phải undefined
                await this.productsService.decreaseVariantStock(item.variantId, item.quantity);
                
                console.log(`✅ Stock decreased successfully for variant: ${item.variantId}`);
            }

            // 🔍 BƯỚC 4: TÍNH TOÁN GIÁ TIỀN
            // VÍ DỤ: 
            // - Item 1: 25,000,000 * 2 = 50,000,000
            // - Item 2: 25,000,000 * 1 = 25,000,000  
            // - Subtotal: 75,000,000
            const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
            
            // VÍ DỤ: Hồ Chí Minh = free ship (0), tỉnh khác = 30,000
            const shippingFee = 30000
            
            // VÍ DỤ: 75,000,000 + 0 = 75,000,000
            const total = subtotal + shippingFee;

            console.log('💰 Order calculations:', {
                subtotal: subtotal.toLocaleString('vi-VN'),     // "75.000.000"
                shippingFee: shippingFee.toLocaleString('vi-VN'), // "0"
                total: total.toLocaleString('vi-VN')            // "75.000.000"
            });

            // 🔍 BƯỚC 5: TẠO ORDER RECORD
            // VÍ DỤ: "ORD-20241001-123456"
            const orderNumber = await this.generateOrderNumber();
            
            const order = this.orderRepository.create({
                orderNumber,                                    // "ORD-20241001-123456"
                userId: new ObjectId(userId),                   // ObjectId("670123456789abcdef123456")
                shippingInfo: createOrderDto.shippingInfo,     // { fullName, email, phone, address, ... }
                paymentMethod: createOrderDto.paymentMethod,   // "COD"
                paymentStatus: PaymentStatus.PENDING,          // "PENDING"
                subtotal,                                       // 75000000
                shippingFee,                                    // 0
                discount: 0,                                    // 0 (mặc định)
                total,                                          // 75000000
                status: OrderStatus.PENDING,                   // "PENDING"
                note: createOrderDto.note,                     // "Giao hàng buổi chiều"
                createdAt: new Date(),                          // "2024-10-01T10:30:00.000Z"
                updatedAt: new Date()                           // "2024-10-01T10:30:00.000Z"
            });

            // 🔍 BƯỚC 6: LƯU ORDER VÀO DATABASE
            const savedOrder = await this.orderRepository.save(order);
            console.log('✅ Order saved with ID:', savedOrder._id);
            // Log: Order saved with ID: 671234567890abcdef123456

            // 🔍 BƯỚC 7: LƯU ORDER ITEMS VÀO DATABASE
            // Gán orderId cho từng item rồi lưu
            for (const item of orderItems) {
                item.orderId = savedOrder._id;                  // Liên kết với order vừa tạo
                await this.orderItemRepository.save(item);
            }

            console.log('✅ Order items saved:', orderItems.length);
            // Log: Order items saved: 2

            // 🔍 BƯỚC 8: TRẢ VỀ ORDER VỚI ITEMS ĐỂ FRONTEND HIỂN THỊ
            return await this.findOneWithItems(savedOrder._id.toString());

        } catch (error) {
            console.error('❌ OrderService.create error:', error);
            throw new BadRequestException(error.message || 'Không thể tạo đơn hàng');
        }
    }

    /**
     * 🔧 HELPER: TẠO ORDER ITEMS TỪ FRONTEND REQUEST VỚI GIẢM GIÁ
     * 
     * VÍ DỤ INPUT:
     * items = [
     *   { "productId": "64abc123", "variantId": "64def456", "quantity": 2 }
     * ]
     * 
     * VÍ DỤ OUTPUT (với giảm giá):
     * [
     *   {
     *     "productId": ObjectId("64abc123"),
     *     "productName": "iPhone 15 Pro (256GB - Vàng)",
     *     "unitPrice": 24000000,      // Giá sau giảm 20%
     *     "quantity": 2,
     *     "subtotal": 48000000,       // 24tr * 2
     *     "originalPrice": 30000000,  // Giá gốc
     *     "discountPercent": 20       // % giảm giá
     *   }
     * ]
     */
    private async createOrderItemsFromRequest(items: any[]): Promise<OrderItem[]> {
        const orderItems: OrderItem[] = [];

        for (const item of items) {
            console.log(`🔍 Processing item:`, {
                productId: item.productId,     // "64abc123"
                variantId: item.variantId,     // "64def456" 
                quantity: item.quantity        // 2
            });

            // ✅ VALIDATE: Kiểm tra frontend có gửi đủ thông tin không
            if (!item.productId) {
                throw new BadRequestException('Thiếu productId trong item');
            }

            if (!item.variantId) {
                throw new BadRequestException('Thiếu variantId trong item');
            }

            if (!item.quantity || item.quantity <= 0) {
                throw new BadRequestException('Quantity phải lớn hơn 0');
            }

            // 🔍 LẤY THÔNG TIN PRODUCT TỪ DATABASE
            const productResult = await this.productsService.findOne(item.productId);

            if (!productResult || !productResult.product) {
                throw new BadRequestException(`Sản phẩm ${item.productId} không tồn tại`);
            }

            const { product, variants } = productResult;

            // 🔍 TÌM VARIANT CỤ THỂ MÀ USER CHỌN
            const selectedVariant = variants.find(v => v._id.toString() === item.variantId);

            if (!selectedVariant) {
                throw new BadRequestException(`Variant ${item.variantId} không tồn tại cho sản phẩm ${product.name}`);
            }

            // ✅ TÍNH GIÁ SAU GIẢM GIÁ
            const originalPrice = selectedVariant.price;                           // Giá gốc: 30,000,000
            const discountPercent = selectedVariant.discountPercent || 0;          // % giảm giá: 20%
            const isOnSale = selectedVariant.isOnSale || false;                    // Có đang sale không: true
            
            // Sử dụng getter finalPrice hoặc tính toán thủ công
            let finalPrice = originalPrice;
            if (isOnSale && discountPercent > 0) {
                finalPrice = Math.round(originalPrice * (1 - discountPercent / 100));  // 24,000,000
            }

            const savedAmount = originalPrice - finalPrice;                        // Tiết kiệm: 6,000,000

            console.log(`✅ Found product and variant with discount:`, {
                productName: product.name,                                         // "iPhone 15 Pro"
                variantColor: selectedVariant.color,                               // "Vàng"
                variantStorage: selectedVariant.storage,                           // "256GB"
                originalPrice: originalPrice.toLocaleString('vi-VN'),              // "30.000.000"
                discountPercent: `${discountPercent}%`,                           // "20%"
                finalPrice: finalPrice.toLocaleString('vi-VN'),                   // "24.000.000"
                savedAmount: savedAmount.toLocaleString('vi-VN'),                 // "6.000.000"
                isOnSale,                                                         // true
                variantStock: selectedVariant.stock                               // 100
            });

            // ✅ KIỂM TRA KHO CÓ ĐỦ HÀNG KHÔNG
            if (selectedVariant.stock < item.quantity) {
                throw new BadRequestException(
                    `Variant ${selectedVariant.color} - ${selectedVariant.storage} chỉ còn ${selectedVariant.stock} trong kho, không đủ ${item.quantity}`
                );
            }

            // 💰 TÍNH TIỀN TỪ GIÁ SAU GIẢM GIÁ
            // VÍ DỤ: 24,000,000 * 2 = 48,000,000 (thay vì 30tr * 2 = 60tr)
            const subtotal = finalPrice * item.quantity;

            // 🏗️ TẠO ORDER ITEM VỚI GIÁ ĐÃ GIẢM
            const orderItem = this.orderItemRepository.create({
                productId: new ObjectId(item.productId),                           // ObjectId("64abc123")
                productName: `${product.name} (${selectedVariant.storage} - ${selectedVariant.color})`, // "iPhone 15 Pro (256GB - Vàng)"
                productImageUrl: Array.isArray(selectedVariant.imageUrls) && selectedVariant.imageUrls.length > 0
                    ? selectedVariant.imageUrls[0]                                // "https://example.com/iphone-gold.jpg"
                    : '/placeholder.jpg',                                         // Fallback image
                unitPrice: finalPrice,                                            // ✅ Giá sau giảm: 24,000,000
                quantity: item.quantity,                                          // 2
                subtotal,                                                         // ✅ Tổng sau giảm: 48,000,000
                status: OrderItemStatus.ACTIVE,                                   // "ACTIVE"
                variantId: item.variantId                                        // "64def456" (để tracking)
            });

            // ✅ Thêm thông tin giảm giá để tracking (nếu OrderItem entity hỗ trợ)
            if (isOnSale && discountPercent > 0) {
                (orderItem as any).originalPrice = originalPrice;                 // Giá gốc: 30,000,000
                (orderItem as any).discountPercent = discountPercent;             // % giảm: 20%
                (orderItem as any).savedAmount = savedAmount;                     // Tiết kiệm: 6,000,000
                (orderItem as any).isOnSale = isOnSale;                          // true
            }

            console.log(`✅ Created OrderItem with discount:`, {
                productName: orderItem.productName,                              // "iPhone 15 Pro (256GB - Vàng)"
                originalPrice: originalPrice.toLocaleString('vi-VN'),            // "30.000.000"
                discountPercent: `${discountPercent}%`,                         // "20%"
                finalPrice: orderItem.unitPrice.toLocaleString('vi-VN'),        // "24.000.000"
                quantity: orderItem.quantity,                                    // 2
                subtotal: orderItem.subtotal.toLocaleString('vi-VN'),           // "48.000.000"
                totalSaved: (savedAmount * item.quantity).toLocaleString('vi-VN') // "12.000.000"
            });

            orderItems.push(orderItem);
        }

        return orderItems;
    }

    /**
     * 🚚 TÍNH PHÍ SHIP DỰA TRÊN THÀNH PHỐ
     * 
     * VÍ DỤ:
     * - "Hồ Chí Minh" → 0 VNĐ (free ship)
     * - "Hà Nội" → 0 VNĐ (free ship)  
     * - "Đà Nẵng" → 30,000 VNĐ
     */


    /**
     * 🔢 TẠO MÃ ĐƠN HÀNG DUY NHẤT
     * 
     * VÍ DỤ: "ORD-20241001-123456"
     * Format: ORD-YYYYMMDD-XXXXXX (X = timestamp + random)
     */
    private async generateOrderNumber(): Promise<string> {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // "20241001"
        const timeStr = Date.now().toString().slice(-6);                     // "123456" (6 số cuối của timestamp)
        const randomStr = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // "78"

        const orderNumber = `ORD-${dateStr}-${timeStr}${randomStr}`;         // "ORD-20241001-12345678"

        console.log(`🔢 Generated order number: ${orderNumber}`);

        return orderNumber;
    }

    // 📋 Lấy danh sách đơn hàng của user
    async findAllByUser(userId: string): Promise<Order[]> {
        return await this.orderRepository.find({
            where: { userId: new ObjectId(userId) },
            order: { createdAt: 'DESC' }
        });
    }

    // 📋 Lấy tất cả đơn hàng (Admin)
    async findAll(): Promise<Order[]> {
                const orders = await this.orderRepository.find({
        order: { createdAt: 'DESC' }
    });

    // ✅ Load orderItems cho mỗi order
    for (const order of orders) {
        const orderItems = await this.orderItemRepository.find({
            where: { orderId: order._id }
        });
        (order as any).orderItems = orderItems;
    }

    return orders;
    }

 // 🔍 Lấy chi tiết đơn hàng (Phiên bản log đơn giản)
async findOne(id: string, userId?: string): Promise<Order> {
    
    // Log thẳng ID và UserID như bạn yêu cầu
    console.log(`🔍 OrderService.findOne called with id: ${id}, userId: ${userId}`);

    // ===== PHẦN VALIDATION VẪN RẤT QUAN TRỌNG =====
    // 1. Kiểm tra id có tồn tại và là string không
    if (!id || typeof id !== 'string') {
        throw new BadRequestException('Order ID không hợp lệ');
    }

    // 2. Làm sạch ID (loại bỏ khoảng trắng thừa)
    const trimmedId = id.trim();

    // 3. Kiểm tra định dạng ObjectId (24 ký tự hex)
    if (!/^[0-9a-fA-F]{24}$/.test(trimmedId)) {
        throw new BadRequestException(`Order ID không đúng định dạng: ${trimmedId}`);
    }
    // ===== HẾT PHẦN VALIDATION =====

    try {
        // Chuyển đổi ID sang ObjectId
        const objectId = new ObjectId(trimmedId);
        
        // Chuẩn bị câu truy vấn
        const where: any = { _id: objectId };
        
        // Nếu có userId, thêm vào câu truy vấn để bảo mật
        if (userId) {
            where.userId = new ObjectId(userId);
        }

        // Tìm đơn hàng
        const order = await this.orderRepository.findOne({ where });

        // Nếu không tìm thấy, báo lỗi
        if (!order) {
            throw new NotFoundException('Không tìm thấy đơn hàng');
        }

        // Trả về đơn hàng nếu tìm thấy
        return order;

    } catch (error) {
        // Bắt các lỗi khác (ví dụ: lỗi database) và ném ra
        console.error(`❌ Error in findOne (id: ${trimmedId}):`, error.message);
        throw error;
    }
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

        // Business rule: Delivered => Paid
        if (
            updateOrderDto.status &&
            updateOrderDto.status.toString().toUpperCase() === 'DELIVERED'
        ) {
            order.paymentStatus = PaymentStatus.PAID;
        }

        order.updatedAt = new Date();

        return await this.orderRepository.save(order);
    }

    // ❌ Hủy đơn hàng
    async cancel(id: string, userId: string, reason?: string): Promise<Order> {
        const order = await this.findOneWithItems(id, userId);

        if (!order.isCancellable) {
            throw new BadRequestException('Không thể hủy đơn hàng này');
        }

        order.status = OrderStatus.CANCELLED;
        order.note = reason || order.note;
        order.updatedAt = new Date();

        return await this.orderRepository.save(order);
    }

}