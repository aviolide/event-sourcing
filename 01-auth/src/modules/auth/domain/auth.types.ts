export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface YupiJwtPayload {
  sub: string;      // userId
  email: string;
}