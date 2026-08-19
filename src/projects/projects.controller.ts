import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import { ApiAuth } from 'src/decorators/api-auth.decorator';
import type { AuthUser } from 'src/types/user.type';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ProjectMemberListResponseDto } from './dto/project-member-list-response.dto';
import { ProjectMemberResponseDto } from './dto/project-member-response.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { SetDefaultPageDto } from './dto/set-default-page.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiAuth()
@UseGuards(AccessTokenGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOkResponse({ type: ProjectResponseDto })
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.getProject(user.id, id);
  }

  @ApiOkResponse({ type: ProjectResponseDto })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.updateProject(user.id, id, dto);
  }

  @ApiOkResponse({ type: ProjectResponseDto })
  @Patch(':id/default-page')
  updateDefaultPage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDefaultPageDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.setDefaultPage(user.id, id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.projectsService.deleteProject(user.id, id);
  }

  @ApiOkResponse({ type: ProjectMemberListResponseDto })
  @Get(':id/members')
  async listMembers(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectMemberListResponseDto> {
    const members = await this.projectsService.listMembers(user.id, id);
    return { members };
  }

  @ApiOkResponse({ type: ProjectMemberResponseDto })
  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProjectMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    return this.projectsService.addMember(user.id, id, dto);
  }

  @ApiOkResponse({ type: ProjectMemberResponseDto })
  @Patch(':id/members/:userId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateProjectMemberDto,
  ): Promise<ProjectMemberResponseDto> {
    return this.projectsService.updateMember(user.id, id, targetUserId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ): Promise<void> {
    return this.projectsService.removeMember(user.id, id, targetUserId);
  }
}
