import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
}

export type RequestWithUser = Request & {
  user: AuthUser;
};

export type CreateUserParams = {
  email: string;
  username: string;
  passwordHash: string;
};
