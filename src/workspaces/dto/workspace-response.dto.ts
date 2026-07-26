import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '../enums/workspace.enums';

export class WorkspaceResponseDto {
  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  id!: string;

  @ApiProperty({ example: "Igor's Workspace" })
  name!: string;

  @ApiProperty({ example: 'igors-workspace' })
  slug!: string;

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  ownerId!: string;

  @ApiProperty({
    enum: WorkspaceRole,
    example: WorkspaceRole.OWNER,
  })
  role!: WorkspaceRole;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
