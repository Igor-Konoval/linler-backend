import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceInvitationResponseDto } from './workspace-invitation-response.dto';

export class CreatedInvitationResponseDto extends WorkspaceInvitationResponseDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6...',
  })
  token!: string;
}
