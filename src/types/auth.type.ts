import type { AuthUser } from './user.type';

export type RequestMeta = {
  userAgent?: string;
  ipAddress?: string;
};

export type AuthResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export type Register = {
  email: string;
  username: string;
  password: string;
};

export type Login = {
  email: string;
  password: string;
};
