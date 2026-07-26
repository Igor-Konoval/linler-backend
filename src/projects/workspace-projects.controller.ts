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
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiAuth } from 'src/decorators/api-auth.decorator';
import type { AuthUser } from 'src/types/user.type';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ProjectListResponseDto } from './dto/project-list-response.dto';

@ApiTags('projects')
@ApiAuth()
@UseGuards(AccessTokenGuard)
@Controller('workspaces/:workspaceId/projects')
export class WorkspaceProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOkResponse({ type: ProjectResponseDto })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.createProject(user.id, workspaceId, dto);
  }

  @ApiOkResponse({ type: ProjectListResponseDto })
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<ProjectListResponseDto> {
    const projects = await this.projectsService.listProjects(
      user.id,
      workspaceId,
    );
    return { projects };
  }
}
