/// <reference types="multer" />
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { ENV_VARIABLES } from 'src/constants/env.constants';
import { ERROR_MESSAGES } from 'src/constants/error.constants';

@Injectable()
export class FileService {
  private readonly uploadsDir: string;
  private readonly maxFileSizeBytes: number;
  private readonly allowedMimeTypes: string[];
  private readonly avatarSize: number;
  private readonly avatarQuality: number;

  constructor(private readonly configService: ConfigService) {
    this.uploadsDir = path.join(
      process.cwd(),
      this.configService.get<string>(
        ENV_VARIABLES.UPLOAD_DIR,
        'uploads/avatars',
      ),
    );
    this.maxFileSizeBytes = this.configService.get<number>(
      ENV_VARIABLES.MAX_FILE_SIZE,
      2 * 1024 * 1024,
    );
    this.allowedMimeTypes = this.configService
      .get<string>(ENV_VARIABLES.ALLOWED_MIME_TYPES)
      ?.split(',') ?? ['image/jpeg', 'image/png', 'image/webp'];
    this.avatarSize = Number(
      this.configService.get<number>(ENV_VARIABLES.AVATAR_SIZE, 200),
    );
    this.avatarQuality = Number(
      this.configService.get<number>(ENV_VARIABLES.AVATAR_QUALITY, 85),
    );
  }

  async onModuleInit() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create uploads directory:', error);
    }
  }

  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `${ERROR_MESSAGES.INVALID_FILE_TYPE}. Allowed: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `${ERROR_MESSAGES.FILE_TOO_LARGE}. Max size: ${this.maxFileSizeBytes / 1024 / 1024}MB`,
      );
    }

    try {
      const filename = `${randomUUID()}-${Date.now()}.webp`;
      const filepath = path.join(this.uploadsDir, filename);

      await sharp(file.buffer)
        .resize(this.avatarSize, this.avatarSize, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: this.avatarQuality })
        .toFile(filepath);

      return `${this.configService.get<string>(ENV_VARIABLES.UPLOAD_DIR, 'uploads/avatars')}/${filename}`;
    } catch (error) {
      console.error(`${ERROR_MESSAGES.FAILED_TO_UPLOAD_AVATAR}:`, error);
      throw new InternalServerErrorException(
        ERROR_MESSAGES.FAILED_TO_UPLOAD_AVATAR,
      );
    }
  }

  async deleteAvatar(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl) {
      return;
    }

    try {
      const filename = path.basename(avatarUrl);
      const filepath = path.join(this.uploadsDir, filename);

      await fs.access(filepath);
      await fs.unlink(filepath);
    } catch (error) {
      console.error('Failed to delete avatar:', error);
    }
  }

  getFullAvatarUrl(avatarUrl: string | null): string | null {
    if (!avatarUrl) {
      return null;
    }

    const mediaUrl = this.configService.getOrThrow<string>(
      ENV_VARIABLES.MEDIA_URL,
    );
    return `${mediaUrl}${avatarUrl}`;
  }
}
