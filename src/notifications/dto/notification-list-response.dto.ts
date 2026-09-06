import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from 'src/common/dto/page-meta.dto';
import { NotificationResponseDto } from './notification-response.dto';

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  notifications!: NotificationResponseDto[];

  @ApiProperty({ example: 2 })
  unreadCount!: number;

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
