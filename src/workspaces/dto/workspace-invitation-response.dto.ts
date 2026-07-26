import { ApiProperty } from '@nestjs/swagger';
import {
  WorkspaceInvitationStatus,
  WorkspaceRole,
} from '../enums/workspace.enums';

export class WorkspaceInvitationResponseDto {
  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  id!: string;

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  workspaceId!: string;

  @ApiProperty({ example: 'invitee@example.com' })
  email!: string;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.MEMBER })
  role!: WorkspaceRole;

  @ApiProperty({
    enum: WorkspaceInvitationStatus,
    example: WorkspaceInvitationStatus.PENDING,
  })
  status!: WorkspaceInvitationStatus;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}
