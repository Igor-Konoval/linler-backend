import { IsEnum } from 'class-validator';
import { ASSIGNABLE_ROLES, ProjectRole } from '../enums/project.enums';

export class UpdateProjectMemberDto {
  @IsEnum(ASSIGNABLE_ROLES)
  role!: ProjectRole;
}
