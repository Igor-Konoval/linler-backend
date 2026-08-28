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
import { ENV_VARIABLES } from './constants/env.constants';
import {
  resolveDataPath,
  toPublicUrlPath,
} from './common/utils/upload-path.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

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
    origin: configService.get<string>(
      ENV_VARIABLES.FRONTEND_URL,
      'http://localhost:3000',
    ),
    credentials: true,
  });

  const staticAssetsPath = configService.get<string>(
    ENV_VARIABLES.STATIC_ASSETS_PATH,
    'uploads',
  );
  app.useStaticAssets(resolveDataPath(staticAssetsPath), {
    prefix: toPublicUrlPath(staticAssetsPath),
  });

  if (configService.get<string>(ENV_VARIABLES.NODE_ENV) !== 'production') {
    setupSwagger(app, configService);
  }

  await app.listen(configService.get<number>(ENV_VARIABLES.PORT) ?? 3001);
}

void bootstrap();
