import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import type { AssistantChatReply } from 'src/types/assistant.type';
import type { AuthUser } from 'src/types/user.type';
import { AssistantService } from './assistant.service';
import { AssistantChatDto } from './dto/assistant-chat.dto';
import { AssistantChatResponseDto } from './dto/assistant-chat-response.dto';
import { ApiAuth } from 'src/decorators/api-auth.decorator';

@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @ApiAuth()
  @ApiOperation({ summary: 'Ask the Linler assistant' })
  @ApiOkResponse({ type: AssistantChatResponseDto })
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @Post('chat')
  chat(
    @CurrentUser() user: AuthUser,
    @Body() dto: AssistantChatDto,
  ): Promise<AssistantChatReply> {
    return this.assistantService.chat(user.id, dto);
  }
}
