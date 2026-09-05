import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { FileService } from 'src/common/services/file.service';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { WorkspaceMemberEntity } from 'src/workspaces/entities/workspace-member.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { WorkspaceProjectsController } from './workspace-projects.controller';
import { ProjectEntity } from './entities/project.entity';
import { ProjectMemberEntity } from './entities/project-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEntity,
      ProjectMemberEntity,
      WorkspaceMemberEntity,
    ]),
    AuthModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [WorkspaceProjectsController, ProjectsController],
  providers: [ProjectsService, FileService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
