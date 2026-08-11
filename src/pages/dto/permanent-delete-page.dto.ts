import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PermanentDeleteChildrenStrategy } from '../constants/pages.constants';

export class PermanentDeletePageDto {
  @ApiPropertyOptional({
    enum: PermanentDeleteChildrenStrategy,
  })
  @IsOptional()
  @IsEnum(PermanentDeleteChildrenStrategy)
  strategy?: PermanentDeleteChildrenStrategy;
}
