import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn, ObjectId } from 'typeorm';

@Entity('products')
export class Product {
    @ObjectIdColumn()
    id: ObjectId;

    @Column({ unique: true })
    name: string;

    @Column()
    description: string;

    @Column()
    price: number;

    @Column() // URL ảnh từ Cloudinary
    imageUrl: string;

    @Column({ nullable: true }) // Public ID của ảnh trên Cloudinary để có thể xóa
    imagePublicId: string;

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


