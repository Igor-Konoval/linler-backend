import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdatePageDto {
  @ApiPropertyOptional({ example: 'Product Requirements' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: '✅', nullable: true })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(80)
  icon?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/new-cover.png',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2048)
  cover?: string | null;

  @ApiPropertyOptional({
    example: {
      width: 1280,
      height: 320,
      objectPositionX: 50,
      objectPositionY: 40,
    },
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  coverMeta?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: 1280 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({ example: 320 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  objectPositionX?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  objectPositionY?: number;

  @ApiPropertyOptional({
    example: { mode: 'page', isFullWidth: false },
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  editorMeta?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: 720 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  contentWidth?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  contentOffsetX?: number;

  @ApiPropertyOptional({
    example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614',
    nullable: true,
    description: 'null => move the page to the root of the project',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID('4')
  parentPageId?: string | null;

  @ApiPropertyOptional({
    example: { type: 'doc', content: [{ type: 'paragraph', content: [] }] },
    description: 'Store the entire document as a single JSONB field',
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
