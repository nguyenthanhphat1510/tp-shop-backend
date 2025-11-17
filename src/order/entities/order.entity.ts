import { Entity, Column, ObjectIdColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';

export enum OrderStatus {
  PENDING = 'pending',           // Chờ xử lý
  CONFIRMED = 'confirmed',       // Đã xác nhận
  SHIPPING = 'shipping',         // Đang giao hàng
  DELIVERED = 'delivered',       // Đã giao hàng
  CANCELLED = 'cancelled'        // Đã hủy
}

export enum PaymentStatus {
  PENDING = 'pending',           // Chờ thanh toán
  PAID = 'paid',                // Đã thanh toán
  FAILED = 'failed'             // Thanh toán thất bại
}

export enum PaymentMethod {
  COD = 'cod',                  // Thanh toán khi nhận hàng
  MOMO = 'momo',               // MoMo
  VNPAY = 'vnpay'               // VNPay
}

@Entity('orders')
export class Order {
  @ObjectIdColumn()
  _id: ObjectId;

  // ===== THÔNG TIN CƠ BẢN =====
  @Column({ unique: true })
  orderNumber: string;          // Mã đơn hàng: ORD-20240717-001

  @Column()
  userId: ObjectId;             // ID khách hàng

  // ===== THÔNG TIN GIAO HÀNG =====
  @Column()
  shippingInfo: {
    fullName: string;           // Họ tên người nhận
    phone: string;              // SĐT người nhận
    address: string;            // Địa chỉ chi tiết
  };

  // ===== THÔNG TIN THANH TOÁN =====
  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.COD })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  // ===== THÔNG TIN GIÁ =====
  @Column()
  subtotal: number;             // Tổng tiền hàng

  @Column({ default: 0 })
  shippingFee: number;          // Phí vận chuyển
  
  @Column({ default: 0 })
  discount: number;             // Giảm giá

  @Column()
  total: number;                // Tổng thanh toán cuối cùng

  // ===== TRẠNG THÁI =====
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ nullable: true })
  note: string;                 // Ghi chú từ khách hàng

  // ===== VẬN CHUYỂN (Tùy chọn) =====
  @Column({ nullable: true })
  trackingNumber: string;       // Mã vận đơn

  // ===== TIMESTAMPS =====
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ===== VIRTUAL PROPERTIES =====
  get id(): string {
    return this._id.toString();
  }

  get isCancellable(): boolean {
    return this.status === OrderStatus.PENDING || this.status === OrderStatus.CONFIRMED;
  }
}