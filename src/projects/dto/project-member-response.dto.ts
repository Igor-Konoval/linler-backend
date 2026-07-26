import { ApiProperty } from '@nestjs/swagger';
import { ProjectRole } from '../enums/project.enums';

export class ProjectMemberResponseDto {
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

  @ApiProperty({ enum: ProjectRole, example: ProjectRole.EDITOR })
  role!: ProjectRole;

  @ApiProperty()
  createdAt!: Date;
}
