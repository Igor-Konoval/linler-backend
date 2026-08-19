import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import { ApiAuth } from 'src/decorators/api-auth.decorator';
import type { AuthUser } from 'src/types/user.type';
import { PageAttachmentListResponseDto } from './dto/page-attachment-list-response.dto';
import { PageAttachmentResponseDto } from './dto/page-attachment-response.dto';
import { PageResponseDto } from './dto/page-response.dto';
import { PermanentDeletePageDto } from './dto/permanent-delete-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PagesService } from './pages.service';

@ApiTags('pages')
@ApiAuth()
@UseGuards(AccessTokenGuard)
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @ApiOkResponse({ type: PageResponseDto })
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PageResponseDto> {
    return this.pagesService.getPage(user.id, id);
  }

  @ApiOkResponse({ type: PageResponseDto })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePageDto,
  ): Promise<PageResponseDto> {
    return this.pagesService.updatePage(user.id, id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.pagesService.archivePage(user.id, id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  removePermanently(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PermanentDeletePageDto,
  ): Promise<void> {
    return this.pagesService.permanentDeletePage(user.id, id, dto);
  }

  @ApiOkResponse({ type: PageAttachmentResponseDto })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Attachment file (image/pdf/doc/text/archive)',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/attachments')
  uploadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PageAttachmentResponseDto> {
    return this.pagesService.uploadAttachment(user.id, id, file);
  }

  @ApiOkResponse({ type: PageAttachmentListResponseDto })
  @Get(':id/attachments')
  async listAttachments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PageAttachmentListResponseDto> {
    const attachments = await this.pagesService.listAttachments(user.id, id);
    return { attachments };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<void> {
    return this.pagesService.deleteAttachment(user.id, id, attachmentId);
  }

  @Get(':id/attachments/:attachmentId/download')
  @Header('Cache-Control', 'private, max-age=0, must-revalidate')
  async downloadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const download = await this.pagesService.getAttachmentDownload(
      user.id,
      id,
      attachmentId,
    );

    res.setHeader('Content-Type', download.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${download.fileName}"`,
    );
    res.send(download.buffer);
  }
}
