import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import { ApiAuth } from 'src/decorators/api-auth.decorator';
import type { AuthUser } from 'src/types/user.type';
import { CreatePageDto } from './dto/create-page.dto';
import { PageListResponseDto } from './dto/page-list-response.dto';
import { PageResponseDto } from './dto/page-response.dto';
import { PagesService } from './pages.service';

@ApiTags('pages')
@ApiAuth()
@UseGuards(AccessTokenGuard)
@Controller('projects/:projectId/pages')
export class ProjectPagesController {
  constructor(private readonly pagesService: PagesService) {}

  @ApiOkResponse({ type: PageResponseDto })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreatePageDto,
  ): Promise<PageResponseDto> {
    return this.pagesService.createPage(user.id, projectId, dto);
  }

  @ApiOkResponse({ type: PageListResponseDto })
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<PageListResponseDto> {
    const pages = await this.pagesService.listProjectPages(user.id, projectId);
    return { pages };
  }
}
