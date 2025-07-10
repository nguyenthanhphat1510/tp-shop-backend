// ❌ Đừng import ObjectId từ typeorm
import { Entity, ObjectIdColumn, Column } from 'typeorm';
import { ObjectId } from 'mongodb'; // ✅ CHỈ import ở đây

@Entity('cart_items')
export class CartItem {
    @ObjectIdColumn()
    id: ObjectId;

    @Column()
    userId: ObjectId;

    @Column()
    productId: ObjectId;

    @Column({ default: 1 })
    quantity: number;

    @Column()
    addedAt: Date;

    @Column()
    updatedAt: Date;
}
