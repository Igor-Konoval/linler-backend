import { ApiProperty } from '@nestjs/swagger';
import { ProjectMemberResponseDto } from './project-member-response.dto';

export class ProjectMemberListResponseDto {
  @ApiProperty({ type: [ProjectMemberResponseDto] })
  members!: ProjectMemberResponseDto[];
}
