import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { FileService } from 'src/common/services/file.service';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { ProjectMemberEntity } from 'src/projects/entities/project-member.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { WorkspaceEntity } from 'src/workspaces/entities/workspace.entity';
import { WorkspaceMemberEntity } from 'src/workspaces/entities/workspace-member.entity';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      WorkspaceMemberEntity,
      ProjectMemberEntity,
      WorkspaceEntity,
      UserEntity,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, FileService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
