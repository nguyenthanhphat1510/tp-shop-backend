import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn, ObjectId } from 'typeorm';

@Entity('products')
export class Product {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column({ unique: true })
    name: string;

    @Column()
    description: string;

    @Column()
    price: number;

    // Sửa lại thành mảng string
    @Column({ type: 'array', default: [] })
    imageUrls: string[]; // <-- Mảng URL ảnh

    @Column({ type: 'array', default: [] })
    imagePublicIds: string[]; // <-- Mảng publicId ảnh trên Cloudinary

    @Column('objectid')
    categoryId: ObjectId;

    @Column('objectid')
    subcategoryId: ObjectId;

    @Column({ default: 0 })
    stock: number;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}


