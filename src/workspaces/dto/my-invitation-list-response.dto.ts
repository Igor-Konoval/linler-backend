import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from 'src/common/dto/page-meta.dto';
import { MyInvitationResponseDto } from './my-invitation-response.dto';

export class MyInvitationListResponseDto {
  @ApiProperty({ type: [MyInvitationResponseDto] })
  invitations!: MyInvitationResponseDto[];

  @ApiProperty({ example: 2 })
  unreadCount!: number;

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
