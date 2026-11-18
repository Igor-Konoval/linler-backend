import { ApiProperty } from '@nestjs/swagger';

export class AssistantChatResponseDto {
  @ApiProperty({ example: 'You have one unread notification in Design.' })
  reply!: string;

  @ApiProperty({ example: false })
  changed!: boolean;
}
