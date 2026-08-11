import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { WorkspaceEntity } from '../../workspaces/entities/workspace.entity';
import { ProjectMemberEntity } from './project-member.entity';
import { ProjectVisibility } from '../enums/project.enums';
import { PageEntity } from 'src/pages/entities/page.entity';

@Entity('projects')
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: WorkspaceEntity;

  @Index()
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: UserEntity;

  @Index()
  @Column({ name: 'default_page_id', type: 'uuid', nullable: true })
  defaultPageId!: string | null;

  @OneToOne(() => PageEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'default_page_id',
  })
  defaultPage!: PageEntity | null;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  icon!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: ProjectVisibility,
    default: ProjectVisibility.PRIVATE,
  })
  visibility!: ProjectVisibility;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex!: number;

  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived!: boolean;

  @OneToMany(() => ProjectMemberEntity, (member) => member.project)
  members!: ProjectMemberEntity[];

  @OneToMany(() => PageEntity, (page) => page.project)
  pages!: PageEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
