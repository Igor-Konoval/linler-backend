import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('user_sessions')
export class UserSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, (user) => user.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 255,
  })
  refreshTokenHash!: string;

  @Column({
    name: 'user_agent',
    type: 'text',
    nullable: true,
  })
  userAgent!: string | null;

  @Column({
    name: 'ip_address',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  ipAddress!: string | null;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
  })
  expiresAt!: Date;

  @Column({
    name: 'revoked_at',
    type: 'timestamptz',
    nullable: true,
  })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
