import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { FileService } from 'src/common/services/file.service';
import { ProjectsModule } from 'src/projects/projects.module';
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
  ],
  controllers: [PagesController, ProjectPagesController],
  providers: [PagesService, FileService],
  exports: [PagesService],
})
export class PagesModule {}
