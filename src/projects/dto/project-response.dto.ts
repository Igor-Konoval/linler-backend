import { ApiProperty } from '@nestjs/swagger';
import { ProjectRole, ProjectVisibility } from '../enums/project.enums';

export class ProjectResponseDto {
  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  id!: string;

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  workspaceId!: string;

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  ownerId!: string;

  @ApiProperty({ example: 'Analytics' })
  name!: string;

  @ApiProperty({ example: '📊', nullable: true })
  icon!: string | null;

  @ApiProperty({ example: 'Backend analytics project', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ProjectVisibility, example: ProjectVisibility.PRIVATE })
  visibility!: ProjectVisibility;

  @ApiProperty({ example: 0 })
  orderIndex!: number;

  @ApiProperty({ example: false })
  isArchived!: boolean;

  @ApiProperty({
    enum: ProjectRole,
    example: ProjectRole.EDITOR,
  })
  role!: ProjectRole;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
