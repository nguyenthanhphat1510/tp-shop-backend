// ❌ Đừng import ObjectId từ typeorm
import { Entity, ObjectIdColumn, Column } from 'typeorm';
import { ObjectId } from 'mongodb'; // ✅ CHỈ import ở đây
import { Transform } from 'class-transformer';

@Entity('cart_items')
export class CartItem {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column()
    userId: ObjectId;

    @Column()
    productId: ObjectId;

    @Column({ type: 'int', default: 1 })
    @Transform(({ value }) => Number(value))
    quantity: number;
    @Column()
    addedAt: Date;

    @Column()
    updatedAt: Date;
}
