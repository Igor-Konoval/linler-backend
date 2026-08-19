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
import { WorkspaceEntity } from './workspace.entity';
import {
  WorkspaceInvitationStatus,
  WorkspaceRole,
} from '../enums/workspace.enums';

@Entity('workspace_invitations')
export class WorkspaceInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({
    type: 'enum',
    enum: WorkspaceRole,
    default: WorkspaceRole.MEMBER,
  })
  role!: WorkspaceRole;

  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({
    type: 'enum',
    enum: WorkspaceInvitationStatus,
    default: WorkspaceInvitationStatus.PENDING,
  })
  status!: WorkspaceInvitationStatus;

  @Index()
  @Column({ name: 'invited_by_id', type: 'uuid' })
  invitedById!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by_id' })
  invitedBy!: UserEntity;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
