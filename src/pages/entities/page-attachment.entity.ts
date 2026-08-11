import { UserEntity } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PageEntity } from './page.entity';

@Entity('page_attachments')
export class PageAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'page_id', type: 'uuid' })
  pageId!: string;

  @ManyToOne(() => PageEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page!: PageEntity;

  @Index()
  @Column({ name: 'uploaded_by_id', type: 'uuid' })
  uploadedById!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy!: UserEntity;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'storage_name', type: 'varchar', length: 255 })
  storageName!: string;

  @Column({ name: 'file_url', type: 'varchar', length: 1024 })
  fileUrl!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType!: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
