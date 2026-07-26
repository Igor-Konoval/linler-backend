import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from 'src/common/dto/page-meta.dto';
import { WorkspaceInvitationResponseDto } from './workspace-invitation-response.dto';

export class WorkspaceInvitationListResponseDto {
  @ApiProperty({ type: [WorkspaceInvitationResponseDto] })
  invitations!: WorkspaceInvitationResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
