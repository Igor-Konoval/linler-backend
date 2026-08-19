import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceMemberResponseDto } from './workspace-member-response.dto';

export class WorkspaceMemberListResponseDto {
  @ApiProperty({ type: [WorkspaceMemberResponseDto] })
  members!: WorkspaceMemberResponseDto[];
}
