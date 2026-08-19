import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from '../auth.service';
import type { RequestWithUser } from 'src/types/user.type';
import { ACCESS_TOKEN_COOKIE_NAME } from 'src/constants/auth-cookies.constants';
import { ERROR_MESSAGES } from 'src/constants/error.constants';

type RequestCookies = Record<string, string | undefined>;

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const token = this.getAccessTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException(ERROR_MESSAGES.ACCESS_TOKEN_IS_MISSING);
    }

    request.user = await this.authService.validateAccessToken(token);

    return true;
  }

  private getAccessTokenFromRequest(request: Request): string | undefined {
    const cookies = request.cookies as RequestCookies | undefined;
    const cookieToken = cookies?.[ACCESS_TOKEN_COOKIE_NAME];

    if (cookieToken) {
      return cookieToken;
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }
}
