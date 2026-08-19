import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreatePageDto {
  @ApiProperty({ example: 'Untitled' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ example: '📝', nullable: true })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(80)
  icon?: string | null;

  @ApiPropertyOptional({
    example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614',
    nullable: true,
    description:
      'If provided, the page will be created as a child of this parent page',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID('4')
  parentPageId?: string | null;
}
