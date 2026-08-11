import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class SetDefaultPageDto {
  @ApiProperty({
    example: 'b2d3e27e-8d7f-4d79-9e04-3887c5feb614',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  pageId!: string | null;
}
