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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiAuth } from 'src/decorators/api-auth.decorator';
import type { AuthUser } from 'src/types/user.type';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { WorkspaceResponseDto } from './dto/workspace-response.dto';
import { WorkspaceMemberResponseDto } from './dto/workspace-member-response.dto';
import { CreatedInvitationResponseDto } from './dto/created-invitation-response.dto';
import { WorkspaceListResponseDto } from './dto/workspace-list-response.dto';
import { WorkspaceMemberListResponseDto } from './dto/workspace-member-list-response.dto';
import { WorkspaceInvitationListResponseDto } from './dto/workspace-invitation-list-response.dto';
import { MyInvitationListResponseDto } from './dto/my-invitation-list-response.dto';
import { MarkInvitationsReadDto } from './dto/mark-invitations-read.dto';
import { UnreadCountResponseDto } from './dto/unread-count-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@ApiTags('workspaces')
@ApiAuth()
@UseGuards(AccessTokenGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @ApiOkResponse({ type: WorkspaceResponseDto })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.createWorkspace(user.id, dto);
  }

  @ApiOkResponse({ type: WorkspaceListResponseDto })
  @Get()
  async findMine(
    @CurrentUser() user: AuthUser,
  ): Promise<WorkspaceListResponseDto> {
    const workspaces = await this.workspacesService.findUserWorkspaces(user.id);
    return { workspaces };
  }

  @ApiOkResponse({ type: MyInvitationListResponseDto })
  @Get('invitations/mine')
  findMyInvitations(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<MyInvitationListResponseDto> {
    return this.workspacesService.findMyInvitations(user.email, pagination);
  }

  @ApiOkResponse({ type: UnreadCountResponseDto })
  @Post('invitations/read')
  markInvitationsRead(
    @CurrentUser() user: AuthUser,
    @Body() dto: MarkInvitationsReadDto,
  ): Promise<UnreadCountResponseDto> {
    return this.workspacesService.markInvitationsRead(user.email, dto);
  }

  @ApiOkResponse({ type: UnreadCountResponseDto })
  @Post('invitations/read-all')
  markAllInvitationsRead(
    @CurrentUser() user: AuthUser,
  ): Promise<UnreadCountResponseDto> {
    return this.workspacesService.markAllInvitationsRead(user.email);
  }

  @ApiOkResponse({ type: WorkspaceResponseDto })
  @Post('invitations/accept')
  acceptInvitationByToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: AcceptInvitationDto,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.acceptInvitationByToken(
      user.id,
      user.email,
      dto.token,
    );
  }

  @ApiOkResponse({ type: WorkspaceResponseDto })
  @Post('invitations/:invitationId/accept')
  acceptInvitationById(
    @CurrentUser() user: AuthUser,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.acceptInvitationById(
      user.id,
      user.email,
      invitationId,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('invitations/:invitationId/decline')
  declineInvitation(
    @CurrentUser() user: AuthUser,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    return this.workspacesService.declineInvitation(user.email, invitationId);
  }

  @ApiOkResponse({ type: WorkspaceResponseDto })
  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.getWorkspace(id, user.id);
  }

  @ApiOkResponse({ type: WorkspaceResponseDto })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    return this.workspacesService.updateWorkspace(id, user.id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.workspacesService.deleteWorkspace(id, user.id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/leave')
  leave(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.workspacesService.leaveWorkspace(id, user.id);
  }

  @ApiOkResponse({ type: WorkspaceMemberListResponseDto })
  @Get(':id/members')
  async listMembers(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkspaceMemberListResponseDto> {
    const members = await this.workspacesService.listMembers(id, user.id);
    return { members };
  }

  @ApiOkResponse({ type: WorkspaceMemberResponseDto })
  @Patch(':id/members/:userId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.workspacesService.updateMember(id, user.id, targetUserId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ): Promise<void> {
    return this.workspacesService.removeMember(id, user.id, targetUserId);
  }

  @ApiOkResponse({ type: CreatedInvitationResponseDto })
  @Post(':id/invitations')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteMemberDto,
  ): Promise<CreatedInvitationResponseDto> {
    return this.workspacesService.createInvitation(id, user.id, dto);
  }

  @ApiOkResponse({ type: WorkspaceInvitationListResponseDto })
  @Get(':id/invitations')
  listInvitations(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<WorkspaceInvitationListResponseDto> {
    return this.workspacesService.listInvitations(id, user.id, pagination);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/invitations/:invitationId')
  revokeInvitation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    return this.workspacesService.revokeInvitation(id, user.id, invitationId);
  }
}
