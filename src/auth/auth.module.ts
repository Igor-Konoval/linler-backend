import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSessionEntity } from './entities/user-session.entity';
import { AuthTokenService } from './services/auth-token.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { FileService } from 'src/common/services/file.service';
import { WorkspacesModule } from 'src/workspaces/workspaces.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => WorkspacesModule),
    JwtModule.register({}),
    TypeOrmModule.forFeature([UserSessionEntity]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    AuthCookieService,
    AccessTokenGuard,
    FileService,
  ],
  exports: [AuthService, AccessTokenGuard],
})
export class AuthModule {}
