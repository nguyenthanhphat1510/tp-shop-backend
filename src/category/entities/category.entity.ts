import { Entity, ObjectIdColumn, Column, CreateDateColumn, UpdateDateColumn, ObjectId } from 'typeorm';

@Entity('categories')
export class Category {

    @ObjectIdColumn()
    _id: ObjectId;

    @Column({ default: true })
    isActive: boolean;


    @Column({ unique: true })
    name: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
