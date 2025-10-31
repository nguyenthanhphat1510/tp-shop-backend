import { Entity, ObjectIdColumn, Column, CreateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';

@Entity('reviews')
export class Review {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    user_id: ObjectId;

    @Column()
    product_id: ObjectId;

    @Column()
    variant_id: ObjectId;

    @Column()
    order_id: ObjectId; // ✅ Thêm order_id - bắt buộc

    @Column()
    rating: number; // 1-5 sao

    @Column()
    comment: string;

    @CreateDateColumn()
    created_at: Date;
}