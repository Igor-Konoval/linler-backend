import { Request } from 'express';

type RequestCookies = Record<string, string | undefined>;

export function getCookie(request: Request, name: string): string | undefined {
  const cookies = request.cookies as RequestCookies | undefined;

  return cookies?.[name];
}
