import { Entity, Column, ObjectIdColumn, CreateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';

export enum OrderItemStatus {
    ACTIVE = 'active',             // Bình thường
    CANCELLED = 'cancelled',       // Đã hủy
    RETURNED = 'returned'          // Đã trả
}

@Entity('order_items')
export class OrderItem {
    @ObjectIdColumn()
    _id: ObjectId;

    // ===== LIÊN KẾT =====
    @Column()
    orderId: ObjectId;             // Foreign key tới Order

    @Column()
    productId: ObjectId;           // ID sản phẩm
    
    @Column()
    variantId: ObjectId;           // ID biến thể sản phẩm

    // ===== THÔNG TIN SẢN PHẨM (snapshot) =====
    @Column()
    productName: string;           // Tên sản phẩm

    @Column()
    productImageUrl: string;       // Ảnh sản phẩm

    // ===== GIÁ VÀ SỐ LƯỢNG =====
    @Column()
    unitPrice: number;             // Giá đơn vị

    @Column()
    quantity: number;              // Số lượng

    @Column()
    subtotal: number;              // = unitPrice * quantity

    // ===== TRẠNG THÁI =====
    @Column({ type: 'enum', enum: OrderItemStatus, default: OrderItemStatus.ACTIVE })
    status: OrderItemStatus;

    @Column({ nullable: true })
    cancelReason: string;          // Lý do hủy (nếu có)

    // ===== TIMESTAMPS =====
    @CreateDateColumn()
    createdAt: Date;

    // ===== VIRTUAL PROPERTIES =====
    get id(): string {
        return this._id.toString();
    }

    get isCancellable(): boolean {
        return this.status === OrderItemStatus.ACTIVE;
    }
}