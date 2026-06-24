import { ConfigService } from '@nestjs/config';

export interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  FRONTEND_URL: string;
}

let cachedEnv: EnvConfig | null = null;

function validateEnv(): EnvConfig {
  const configService = new ConfigService();

  const getRequired = (key: string): string => {
    const value = configService.get<string>(key);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  };

  return {
    PORT: configService.get<number>('PORT') ?? 3001,
    NODE_ENV: configService.get('NODE_ENV') ?? 'development',
    POSTGRES_USER: getRequired('POSTGRES_USER'),
    POSTGRES_PASSWORD: getRequired('POSTGRES_PASSWORD'),
    POSTGRES_DB: getRequired('POSTGRES_DB'),
    POSTGRES_HOST: getRequired('POSTGRES_HOST'),
    POSTGRES_PORT: configService.get<number>('POSTGRES_PORT') ?? 5432,
    JWT_ACCESS_SECRET: getRequired('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: getRequired('JWT_REFRESH_SECRET'),
    JWT_ACCESS_EXPIRES_IN: configService.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    JWT_REFRESH_EXPIRES_IN:
      configService.get('JWT_REFRESH_EXPIRES_IN') ?? '30d',
    FRONTEND_URL: configService.get('FRONTEND_URL') ?? 'http://localhost:3000',
  };
}

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}
