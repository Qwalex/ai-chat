import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export const INITIAL_TOKEN_BALANCE = 100;

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column('integer', { default: INITIAL_TOKEN_BALANCE })
  tokenBalance: number;

  @CreateDateColumn()
  createdAt: Date;
}
