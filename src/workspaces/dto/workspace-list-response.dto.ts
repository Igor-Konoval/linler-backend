import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceResponseDto } from './workspace-response.dto';

export class WorkspaceListResponseDto {
  @ApiProperty({ type: [WorkspaceResponseDto] })
  workspaces!: WorkspaceResponseDto[];
}
