import { Entity, ObjectIdColumn, Column, ObjectId } from 'typeorm';

@Entity('users')
export class User {
    @ObjectIdColumn()
    id: ObjectId;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column({ nullable: true })
    fullName: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: () => new Date() })
    createdAt: Date;

    @Column({ default: () => new Date() })
    updatedAt: Date;
}
