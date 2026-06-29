import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { AuthTokenService } from './services/auth-token.service';
import { REFRESH_TTL_MS } from 'src/constants/auth-cookies.constants';
import { UserSessionEntity } from './entities/user-session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type {
  AuthResult,
  Login,
  Register,
  RequestMeta,
} from 'src/types/auth.type';
import * as bcrypt from 'bcrypt';
import { hashToken } from 'src/modules/auth/utils/token-hash.utils';
import type { AuthUser } from 'src/types/user.type';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { ENV_VARIABLES } from 'src/constants/env.constants';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/common/services/file.service';

@Injectable()
export class AuthService {
  private readonly refreshTtlMs = REFRESH_TTL_MS;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authTokenService: AuthTokenService,
    private readonly fileService: FileService,
    @InjectRepository(UserSessionEntity)
    private readonly sessionsRepository: Repository<UserSessionEntity>,
  ) {}

  private toAuthUser(user: AuthUser): AuthUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: this.fileService.getFullAvatarUrl(user.avatarUrl),
    };
  }

  async register(params: Register, meta: RequestMeta): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(params.password, 4);

    const user = await this.usersService.create({
      email: params.email.toLowerCase(),
      username: params.username,
      passwordHash,
    });

    return this.createAuthSession(user, meta);
  }

  async login(params: Login, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithPassword(
      params.email.toLowerCase(),
    );

    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(
      params.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    return this.createAuthSession(user, meta);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload =
      await this.authTokenService.verifyRefreshToken(refreshToken);

    const session = await this.sessionsRepository.findOne({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
      },
      relations: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException(ERROR_MESSAGES.SESSION_NOT_FOUND);
    }

    if (session.revokedAt) {
      throw new UnauthorizedException(ERROR_MESSAGES.SESSION_WAS_REVOKED);
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(ERROR_MESSAGES.SESSION_EXPIRED);
    }

    const incomingRefreshHash = hashToken(refreshToken);

    if (session.refreshTokenHash !== incomingRefreshHash) {
      session.revokedAt = new Date();
      await this.sessionsRepository.save(session);

      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const user = session.user;

    const accessToken = await this.authTokenService.signAccessToken({
      sub: user.id,
      sessionId: session.id,
      email: user.email,
    });

    const newRefreshToken = await this.authTokenService.signRefreshToken({
      sub: user.id,
      sessionId: session.id,
    });

    session.refreshTokenHash = hashToken(newRefreshToken);
    await this.sessionsRepository.save(session);

    return {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken: newRefreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload =
        await this.authTokenService.verifyRefreshToken(refreshToken);

      await this.sessionsRepository.update(
        {
          id: payload.sessionId,
          userId: payload.sub,
        },
        {
          revokedAt: new Date(),
        },
      );
    } catch (error) {
      if (
        this.configService.get<string>(ENV_VARIABLES.NODE_ENV) !== 'production'
      ) {
        if (error instanceof Error) {
          console.error(`Logout failed: ${error.message}`);
        }
      }
    }
  }

  async validateAccessToken(accessToken: string): Promise<AuthUser> {
    const payload = await this.authTokenService.verifyAccessToken(accessToken);

    const session = await this.sessionsRepository.findOne({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
      },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_SESSION);
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return this.toAuthUser(user);
  }

  private async createAuthSession(
    user: AuthUser,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);

    const session = this.sessionsRepository.create({
      userId: user.id,
      refreshTokenHash: 'temporary',
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
      expiresAt: refreshExpiresAt,
      revokedAt: null,
    });

    const savedSession = await this.sessionsRepository.save(session);

    const accessToken = await this.authTokenService.signAccessToken({
      sub: user.id,
      sessionId: savedSession.id,
      email: user.email,
    });

    const refreshToken = await this.authTokenService.signRefreshToken({
      sub: user.id,
      sessionId: savedSession.id,
    });

    savedSession.refreshTokenHash = hashToken(refreshToken);
    await this.sessionsRepository.save(savedSession);

    return {
      user: this.toAuthUser(user),
      accessToken,
      refreshToken,
      refreshExpiresAt,
    };
  }
}
