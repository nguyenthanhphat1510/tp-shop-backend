import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn, ObjectId } from 'typeorm';

@Entity('subcategories')
export class Subcategory {
    @ObjectIdColumn()
    _id: ObjectId;
    
    @Column({ unique: true })
    name: string;

    @Column('objectid')
    categoryId: ObjectId; // ✅ Đổi từ string thành ObjectId

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
