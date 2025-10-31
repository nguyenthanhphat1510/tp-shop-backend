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

      // ✅ THÊM 2 FIELD NÀY (CƠ BẢN)
    @Column({ type: 'array', default: [] })
    embedding: number[]; // Vector từ Gemini

    @Column({ default: '' })
    searchText: string; // Text dùng để tạo vector

    @Column({ default: 0 })
    ratings_average: number; // Rating trung bình

    @Column({ default: 0 })
    ratings_count: number; // Số lượng đánh giá

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

 // ✅ HELPER: Create search text (ENGLISH)
    createSearchText(): string {
        return `${this.name} ${this.description}`.toLowerCase().trim();
    }
}


