import { Entity, ObjectIdColumn, Column, ObjectId } from 'typeorm';

@Entity('users')
export class User {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true, default: null }) // FIX: Explicitly allow null
    password: string | null;

    @Column({ nullable: true })
    fullName: string;

    @Column({ default: 'user' })
    role: string;   

    @Column({ default: true })
    isActive: boolean;

    @Column({ nullable: true })
    googleId: string;

    @Column({ nullable: true })
    avatar: string;

    @Column({ nullable: true })
    lastLoginAt: Date;

    @Column({ nullable: true })
    lastLoginMethod: string;

    @Column({ default: () => new Date() })
    createdAt: Date;

    @Column({ default: () => new Date() })
    updatedAt: Date;
}
