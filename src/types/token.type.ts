export interface AccessTokenPayload {
  sub: string;
  sessionId: string;
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
}
