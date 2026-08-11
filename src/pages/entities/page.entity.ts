import { ProjectEntity } from 'src/projects/entities/project.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { PageAttachmentEntity } from './page-attachment.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index(['projectId', 'parentPageId', 'orderIndex'])
@Entity('pages')
export class PageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => ProjectEntity, (project) => project.pages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: ProjectEntity;

  @Index()
  @Column({ name: 'parent_page_id', type: 'uuid', nullable: true })
  parentPageId!: string | null;

  @ManyToOne(() => PageEntity, (page) => page.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_page_id' })
  parentPage!: PageEntity | null;

  @OneToMany(() => PageEntity, (page) => page.parentPage)
  children!: PageEntity[];

  @OneToMany(() => PageAttachmentEntity, (attachment) => attachment.page)
  attachments!: PageAttachmentEntity[];

  @Index()
  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: UserEntity;

  @Index()
  @Column({ name: 'updated_by_id', type: 'uuid' })
  updatedById!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy!: UserEntity;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  icon!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  cover!: string | null;

  @Column({ name: 'cover_meta', type: 'jsonb', nullable: true })
  coverMeta!: Record<string, unknown> | null;

  @Column({ type: 'float', default: 1280 })
  width!: number;

  @Column({ type: 'float', default: 320 })
  height!: number;

  @Column({ name: 'object_position_x', type: 'float', default: 50 })
  objectPositionX!: number;

  @Column({ name: 'object_position_y', type: 'float', default: 50 })
  objectPositionY!: number;

  @Column({ name: 'editor_meta', type: 'jsonb', nullable: true })
  editorMeta!: Record<string, unknown> | null;

  @Column({ name: 'content_width', type: 'float', default: 720 })
  contentWidth!: number;

  @Column({ name: 'content_offset_x', type: 'float', default: 0 })
  contentOffsetX!: number;

  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex!: number;

  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
