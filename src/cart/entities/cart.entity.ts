import { Entity, ObjectIdColumn, Column, ObjectId } from 'typeorm';

@Entity('cart_items')
export class CartItem {
    @ObjectIdColumn()
    id: ObjectId;

    @Column('objectid') // ✅ Chỉ định type rõ ràng
    userId: ObjectId;

    @Column('objectid') // ✅ Chỉ định type rõ ràng
    productId: ObjectId;

    @Column('int', { default: 1 }) // ✅ Chỉ định type rõ ràng
    quantity: number;

    @Column('timestamp', { default: () => new Date() }) // ✅ Chỉ định type rõ ràng
    addedAt: Date;

    @Column('timestamp', { default: () => new Date() }) // ✅ Chỉ định type rõ ràng
    updatedAt: Date;
}