import { ApiProperty } from '@nestjs/swagger';

export class PageAttachmentResponseDto {
  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  id!: string;

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  pageId!: string;

  @ApiProperty({ example: 'image.png' })
  originalName!: string;

  @ApiProperty({ example: 'image.png' })
  title!: string;

  @ApiProperty({ example: 'image/png' })
  mimeType!: string;

  @ApiProperty({ example: 102400 })
  fileSize!: number;

  @ApiProperty({ example: '/uploads/attachments/uuid.png' })
  fileUrl!: string;

  @ApiProperty({
    example: 'https://cdn.example.com/uploads/attachments/uuid.png',
  })
  fullUrl!: string;

  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  uploadedById!: string;

  @ApiProperty()
  createdAt!: Date;
}
