import { IsEnum, IsOptional } from 'class-validator';
import { WorkspaceMemberStatus, WorkspaceRole } from '../enums/workspace.enums';

const ASSIGNABLE_ROLES = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.VIEWER,
] as const;

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(ASSIGNABLE_ROLES)
  role?: WorkspaceRole;

  @IsOptional()
  @IsEnum(WorkspaceMemberStatus)
  status?: WorkspaceMemberStatus;
}
