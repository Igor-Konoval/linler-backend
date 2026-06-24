import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from 'src/types/token.type';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync<AccessTokenPayload>(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<'15m' | '1h' | '30d'>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ),
    });
  }

  async signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    return this.jwtService.signAsync<RefreshTokenPayload>(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<'15m' | '1h' | '30d'>(
        'JWT_REFRESH_EXPIRES_IN',
        '30d',
      ),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }
}
