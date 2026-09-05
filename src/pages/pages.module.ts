import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { FileService } from 'src/common/services/file.service';
import { ProjectsModule } from 'src/projects/projects.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { PageAttachmentEntity } from './entities/page-attachment.entity';
import { PageEntity } from './entities/page.entity';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { ProjectPagesController } from './project-pages.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PageEntity, PageAttachmentEntity]),
    AuthModule,
    ProjectsModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [PagesController, ProjectPagesController],
  providers: [PagesService, FileService],
  exports: [PagesService],
})
export class PagesModule {}
