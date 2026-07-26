import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { WorkspaceRole } from '../enums/workspace.enums';
import { INVITABLE_ROLES } from '../constants/workspace.constants';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(INVITABLE_ROLES)
  role?: WorkspaceRole;
}
