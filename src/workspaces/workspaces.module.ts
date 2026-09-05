import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { FileService } from 'src/common/services/file.service';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceEntity } from './entities/workspace.entity';
import { WorkspaceMemberEntity } from './entities/workspace-member.entity';
import { WorkspaceInvitationEntity } from './entities/workspace-invitation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceEntity,
      WorkspaceMemberEntity,
      WorkspaceInvitationEntity,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, FileService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
