import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ConversationEntity } from './conversation.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  conversationId: string;

  @ManyToOne(() => ConversationEntity, (c) => c.messageEntities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation?: ConversationEntity;

  @Column({ length: 20 })
  role: string;

  /** JSON: string or array (multimodal) */
  @Column('text')
  content: string;

  /** JSON: costUsd, costRub, etc. */
  @Column('text', { nullable: true })
  meta: string | null;

  @Column('int', { default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
