import { ApiProperty } from '@nestjs/swagger';
import { PageAttachmentResponseDto } from './page-attachment-response.dto';

export class PageAttachmentListResponseDto {
  @ApiProperty({ type: [PageAttachmentResponseDto] })
  attachments!: PageAttachmentResponseDto[];
}
