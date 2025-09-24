import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn, ObjectId } from 'typeorm';

@Entity('products')
export class Product {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column({ unique: true })
    name: string;

    @Column()
    description: string;

    @Column('objectid')
    categoryId: ObjectId;

    @Column('objectid')
    subcategoryId: ObjectId;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}


