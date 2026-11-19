import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  ASSISTANT_LIMITS,
  ASSISTANT_ROLE,
} from 'src/constants/assistant.constants';

export class AssistantHistoryItemDto {
  @ApiProperty({
    enum: [ASSISTANT_ROLE.USER, ASSISTANT_ROLE.ASSISTANT],
    example: ASSISTANT_ROLE.USER,
  })
  @IsIn([ASSISTANT_ROLE.USER, ASSISTANT_ROLE.ASSISTANT])
  role!: typeof ASSISTANT_ROLE.USER | typeof ASSISTANT_ROLE.ASSISTANT;

  @ApiProperty({
    minLength: ASSISTANT_LIMITS.MESSAGE_MIN_LENGTH,
    maxLength: ASSISTANT_LIMITS.HISTORY_CONTENT_MAX_LENGTH,
    example: 'Draft a short project update.',
  })
  @IsString()
  @MinLength(ASSISTANT_LIMITS.MESSAGE_MIN_LENGTH)
  @MaxLength(ASSISTANT_LIMITS.HISTORY_CONTENT_MAX_LENGTH)
  content!: string;
}

export class AssistantChatDto {
  @ApiProperty({
    minLength: ASSISTANT_LIMITS.MESSAGE_MIN_LENGTH,
    maxLength: ASSISTANT_LIMITS.MESSAGE_MAX_LENGTH,
    example: 'Summarize my unread notifications.',
  })
  @IsString()
  @MinLength(ASSISTANT_LIMITS.MESSAGE_MIN_LENGTH)
  @MaxLength(ASSISTANT_LIMITS.MESSAGE_MAX_LENGTH)
  message!: string;

  @ApiPropertyOptional({
    type: [AssistantHistoryItemDto],
    maxItems: ASSISTANT_LIMITS.HISTORY_MAX_ITEMS,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ASSISTANT_LIMITS.HISTORY_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => AssistantHistoryItemDto)
  history?: AssistantHistoryItemDto[];
}
