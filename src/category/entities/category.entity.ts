import { Entity, Column, ObjectIdColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectId } from 'mongodb';

@Entity('categories')
export class Category {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  name: string;

  @Column({ default: true }) // ✅ Set default value
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
