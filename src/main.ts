import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import {
  BadRequestException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { getFieldErrors } from './modules/auth/utils/error.utils';
import { setupSwagger } from './config/swagger.config';
import { ERROR_CODES, ERROR_MESSAGES } from './constants/error.constants';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,

      exceptionFactory: (validationErrors) => {
        const fieldErrors = getFieldErrors(validationErrors);

        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          code: ERROR_CODES.VALIDATION_ERROR,
          errorMessage: ERROR_MESSAGES.VALIDATION_FAILED,
          fieldErrors,
        });
      },
    }),
  );

  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  const staticAssetsPath = configService.get<string>(
    'STATIC_ASSETS_PATH',
    'uploads',
  );
  app.useStaticAssets(join(process.cwd(), staticAssetsPath), {
    prefix: `/${staticAssetsPath}`,
  });

  if (configService.get<string>('NODE_ENV') !== 'production') {
    setupSwagger(app, configService);
  }

  await app.listen(configService.get<number>('PORT') ?? 3001);
}

void bootstrap();
