import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('token_usage')
export class TokenUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column()
  modelId: string;

  @Column()
  modelLabel: string;

  @Column('integer')
  tokensSpent: number;

  @Column('real', { nullable: true })
  costUsd: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
