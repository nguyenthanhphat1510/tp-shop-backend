// File: src/products/entities/product-variant.entity.ts
import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';

@Entity('product_variants')
export class ProductVariant {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    productId: ObjectId;

    @Column({ unique: true })
    sku: string;

    @Column()
    storage: string;

    @Column()
    color: string;

    @Column()
    price: number; // Giá gốc

    // ✅ THÊM FIELD GIẢM GIÁ
    @Column({ default: 0 })
    discountPercent: number; // % giảm giá (0-100)

    @Column({ default: false })
    isOnSale: boolean; // Có đang giảm giá không

         // ✅ THÊM 2 FIELD NÀY (CƠ BẢN)
       @Column({ type: 'array', default: [] })
       embedding: number[]; // Vector từ Gemini
   
       @Column({ default: '' })
       searchText: string; // Text dùng để tạo vector

    @Column()
    stock: number;

    @Column({ default: [] })
    imageUrls: string[];

    @Column({ default: [] })
    imagePublicIds: string[];

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 0 })
    sold: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // ✅ GETTER: Tính giá sau giảm
    get finalPrice(): number {
        if (this.isOnSale && this.discountPercent > 0) {
            return Math.round(this.price * (1 - this.discountPercent / 100));
        }
        return this.price;
    }

    // ✅ GETTER: Số tiền tiết kiệm
    get savedAmount(): number {
        return this.price - this.finalPrice;
    }
}