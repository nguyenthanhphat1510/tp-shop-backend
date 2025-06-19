import { Entity, ObjectIdColumn, Column, ObjectId } from 'typeorm';
@Entity('products')
export class Product {
    @ObjectIdColumn()
    id: ObjectId;

    @Column()
    name: string;

    @Column()
    description: string;

    @Column()
    price: number;

    @Column()
    imageUrl: string;

    @Column()
    category: string;

    @Column({ default: 0 })
    stock: number;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: () => new Date() })
    createdAt: Date;

    @Column({ default: () => new Date() })
    updatedAt: Date;
}


