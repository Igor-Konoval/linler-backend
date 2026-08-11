import { ApiProperty } from '@nestjs/swagger';

export class PageTreeItemResponseDto {
  @ApiProperty({ example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614' })
  id!: string;

  @ApiProperty({
    example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614',
    nullable: true,
  })
  parentPageId!: string | null;

  @ApiProperty({ example: 'Home' })
  title!: string;

  @ApiProperty({ example: '🏠', nullable: true })
  icon!: string | null;

  @ApiProperty({ example: 0 })
  orderIndex!: number;

  @ApiProperty({ example: false })
  isArchived!: boolean;
}
