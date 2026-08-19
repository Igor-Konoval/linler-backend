import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ASSIGNABLE_ROLES, ProjectRole } from '../enums/project.enums';

export class AddProjectMemberDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsEnum(ASSIGNABLE_ROLES)
  role?: ProjectRole;
}
