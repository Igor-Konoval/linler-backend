import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { REFRESH_TOKEN_COOKIE_NAME } from 'src/constants/auth-cookies.constants';
import type { AuthUser } from 'src/types/user.type';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthCookieService } from './services/auth-cookie.service';
import { getCookie } from 'src/utils/cookie.utils';
import { ApiOkResponse } from '@nestjs/swagger';
import { AuthUserResponseDto } from './dto/me.dto';
import { ApiAuth } from 'src/decorators/api-auth.decorator';
import { ERROR_MESSAGES } from 'src/constants/error.constants';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @ApiOkResponse({
    type: AuthUserResponseDto,
  })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(
      {
        username: dto.username,
        email: dto.email,
        password: dto.password,
      },
      { ipAddress: request.ip, userAgent: request.headers['user-agent'] },
    );

    this.authCookieService.setAuthCookies(response, {
      accessToken: result.accessToken,
      refreshExpiresAt: result.refreshExpiresAt,
      refreshToken: result.refreshToken,
    });

    return result.user;
  }

  @ApiOkResponse({
    type: AuthUserResponseDto,
  })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      {
        email: dto.email,
        password: dto.password,
      },
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );

    this.authCookieService.setAuthCookies(response, {
      accessToken: result.accessToken,
      refreshExpiresAt: result.refreshExpiresAt,
      refreshToken: result.refreshToken,
    });

    return result.user;
  }

  @ApiOkResponse({
    type: AuthUserResponseDto,
  })
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = getCookie(request, REFRESH_TOKEN_COOKIE_NAME);

    if (!refreshToken) {
      throw new UnauthorizedException(ERROR_MESSAGES.REFRESH_TOKEN_IS_MISSING);
    }

    const result = await this.authService.refresh(refreshToken);

    this.authCookieService.setAuthCookies(response, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      refreshExpiresAt: result.refreshExpiresAt,
    });

    return result.user;
  }

  @ApiAuth()
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = getCookie(request, REFRESH_TOKEN_COOKIE_NAME);

    await this.authService.logout(refreshToken);

    this.authCookieService.clearAuthCookies(response);
  }

  @ApiOkResponse({
    type: AuthUserResponseDto,
  })
  @ApiAuth()
  @UseGuards(AccessTokenGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
