import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../enums/notification.enums';
import type { NotificationPayload } from '../notification.types';

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: NotificationPayload;

  @ApiProperty({ example: false })
  isRead!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
