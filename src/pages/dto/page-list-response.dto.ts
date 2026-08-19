import { ApiProperty } from '@nestjs/swagger';
import { PageTreeItemResponseDto } from './page-tree-item-response.dto';

export class PageListResponseDto {
  @ApiProperty({ type: [PageTreeItemResponseDto] })
  pages!: PageTreeItemResponseDto[];
}
