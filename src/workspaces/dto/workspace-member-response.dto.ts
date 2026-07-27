import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceMemberStatus, WorkspaceRole } from '../enums/workspace.enums';

export class WorkspaceMemberResponseDto {
  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  id!: string;

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  userId!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Igor' })
  username!: string;

  @ApiProperty({ example: 'https://example.com/avatar.png', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.MEMBER })
  role!: WorkspaceRole;

  @ApiProperty({
    enum: WorkspaceMemberStatus,
    example: WorkspaceMemberStatus.ACTIVE,
  })
  status!: WorkspaceMemberStatus;

  @ApiProperty()
  joinedAt!: Date;
}
