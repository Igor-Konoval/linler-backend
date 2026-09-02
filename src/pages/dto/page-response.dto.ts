import { ApiProperty } from '@nestjs/swagger';
import { ProjectRole } from 'src/projects/enums/project.enums';
import { PageAttachmentResponseDto } from './page-attachment-response.dto';

export class PageResponseDto {
  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  id!: string;

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  projectId!: string;

  @ApiProperty({
    example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614',
    nullable: true,
  })
  parentPageId!: string | null;

  @ApiProperty({ example: 'Home' })
  title!: string;

  @ApiProperty({ example: '🏠', nullable: true })
  icon!: string | null;

  @ApiProperty({ example: 'https://cdn.example.com/cover.png', nullable: true })
  cover!: string | null;

  @ApiProperty({
    example: {
      width: 1280,
      height: 320,
      objectPositionX: 50,
      objectPositionY: 40,
    },
    nullable: true,
  })
  coverMeta!: Record<string, unknown> | null;

  @ApiProperty({ example: 1280 })
  width!: number;

  @ApiProperty({ example: 320 })
  height!: number;

  @ApiProperty({ example: 50 })
  objectPositionX!: number;

  @ApiProperty({ example: 50 })
  objectPositionY!: number;

  @ApiProperty({
    example: { mode: 'page', isFullWidth: false },
    nullable: true,
  })
  editorMeta!: Record<string, unknown> | null;

  @ApiProperty({ example: 720 })
  contentWidth!: number;

  @ApiProperty({ example: 0 })
  contentOffsetX!: number;

  @ApiProperty({
    example: { type: 'doc', content: [] },
    description:
      'Tiptap document JSON. May contain one or more taskBoard nodes stored as-is after sanitization',
  })
  content!: Record<string, unknown>;

  @ApiProperty({ example: 0 })
  orderIndex!: number;

  @ApiProperty({ example: false })
  isArchived!: boolean;

  @ApiProperty({ type: [PageAttachmentResponseDto] })
  attachments!: PageAttachmentResponseDto[];

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  createdById!: string;

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  updatedById!: string;

  @ApiProperty({ enum: ProjectRole, example: ProjectRole.EDITOR })
  projectRole!: ProjectRole;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
