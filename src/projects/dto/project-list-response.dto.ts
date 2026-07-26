import { ApiProperty } from '@nestjs/swagger';
import { ProjectResponseDto } from './project-response.dto';

export class ProjectListResponseDto {
  @ApiProperty({ type: [ProjectResponseDto] })
  projects!: ProjectResponseDto[];
}
