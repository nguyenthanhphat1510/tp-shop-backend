// File: src/products/entities/product-variant.entity.ts
import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';

@Entity('product_variants')
export class ProductVariant {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    productId: ObjectId; // Link tới Product chính

    @Column({ unique: true })
    sku: string; // Mã định danh duy nhất: "IPHONE16-128GB-BLACK"

    @Column()
    storage: string; // "128GB", "256GB", "512GB"

    @Column()
    color: string; // "Đen", "Trắng", "Xanh"

    @Column()
    price: number; // Giá cụ thể cho variant này

    @Column()
    stock: number; // Số lượng tồn kho

    @Column({ default: [] })
    imageUrls: string[]; // Ảnh riêng cho variant (theo màu)

    @Column({ default: [] })
    imagePublicIds: string[];

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 0 })
    sold: number; // Số lượng đã bán

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}