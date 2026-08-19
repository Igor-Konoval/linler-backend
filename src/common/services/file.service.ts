/// <reference types="multer" />
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { ENV_VARIABLES } from 'src/constants/env.constants';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_FILE_TYPES,
  ALLOWED_MIME_TYPES,
  ATTACHMENTS_UPLOAD_DIR,
  AVATARS_UPLOAD_DIR,
} from 'src/constants/file.constants';
import {
  resolveDataPath,
  toPublicUrlPath,
} from 'src/common/utils/upload-path.util';

@Injectable()
export class FileService {
  private readonly avatarUploadsDir: string;
  private readonly avatarPublicDir: string;
  private readonly avatarMaxFileSizeBytes: number;
  private readonly avatarAllowedMimeTypes: string[];
  private readonly avatarSize: number;
  private readonly avatarQuality: number;

  private readonly attachmentsUploadsDir: string;
  private readonly attachmentsPublicDir: string;
  private readonly attachmentsMaxFileSizeBytes: number;
  private readonly attachmentsAllowedMimeTypes: string[];
  private readonly attachmentsAllowedExtensions: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const rawAvatarUploadDir = this.configService.get<string>(
      ENV_VARIABLES.UPLOAD_DIR,
      AVATARS_UPLOAD_DIR,
    );
    this.avatarUploadsDir = resolveDataPath(rawAvatarUploadDir);
    this.avatarPublicDir = toPublicUrlPath(rawAvatarUploadDir);

    this.avatarMaxFileSizeBytes = this.configService.get<number>(
      ENV_VARIABLES.MAX_FILE_SIZE,
      2 * 1024 * 1024,
    );
    this.avatarAllowedMimeTypes =
      this.configService
        .get<string>(ENV_VARIABLES.ALLOWED_MIME_TYPES)
        ?.split(',') ?? ALLOWED_MIME_TYPES;
    this.avatarSize = Number(
      this.configService.get<number>(ENV_VARIABLES.AVATAR_SIZE, 200),
    );
    this.avatarQuality = Number(
      this.configService.get<number>(ENV_VARIABLES.AVATAR_QUALITY, 85),
    );

    const rawAttachmentsUploadDir = this.configService.get<string>(
      ENV_VARIABLES.ATTACHMENTS_UPLOAD_DIR,
      ATTACHMENTS_UPLOAD_DIR,
    );
    this.attachmentsUploadsDir = resolveDataPath(rawAttachmentsUploadDir);
    this.attachmentsPublicDir = toPublicUrlPath(rawAttachmentsUploadDir);
    this.attachmentsMaxFileSizeBytes = Number(
      this.configService.get<number>(
        ENV_VARIABLES.ATTACHMENTS_MAX_FILE_SIZE,
        25 * 1024 * 1024,
      ),
    );
    this.attachmentsAllowedMimeTypes =
      this.configService
        .get<string>(ENV_VARIABLES.ATTACHMENTS_ALLOWED_MIME_TYPES)
        ?.split(',')
        .map((value) => value.trim())
        .filter(Boolean) ?? ALLOWED_FILE_TYPES;
    this.attachmentsAllowedExtensions = new Set(ALLOWED_FILE_EXTENSIONS);
  }

  async onModuleInit() {
    try {
      await fs.mkdir(this.avatarUploadsDir, { recursive: true });
      await fs.mkdir(this.attachmentsUploadsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create uploads directory:', error);
    }
  }

  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    if (!this.avatarAllowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `${ERROR_MESSAGES.INVALID_FILE_TYPE}. Allowed: ${this.avatarAllowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > this.avatarMaxFileSizeBytes) {
      throw new BadRequestException(
        `${ERROR_MESSAGES.FILE_TOO_LARGE}. Max size: ${this.avatarMaxFileSizeBytes / 1024 / 1024}MB`,
      );
    }

    try {
      const filename = `${randomUUID()}-${Date.now()}.webp`;
      const filepath = path.join(this.avatarUploadsDir, filename);

      await sharp(file.buffer)
        .resize(this.avatarSize, this.avatarSize, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: this.avatarQuality })
        .toFile(filepath);

      return `${this.avatarPublicDir}/${filename}`;
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
      const filepath = path.join(this.avatarUploadsDir, filename);

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
    return `${mediaUrl}${toPublicUrlPath(avatarUrl)}`;
  }

  async uploadAttachment(file: Express.Multer.File): Promise<{
    storageName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
    originalName: string;
  }> {
    if (!this.isAttachmentTypeAllowed(file)) {
      throw new BadRequestException(
        `${ERROR_MESSAGES.INVALID_FILE_TYPE}. Allowed: ${this.attachmentsAllowedMimeTypes.join(', ')}`,
      );
    }

    if (file.size > this.attachmentsMaxFileSizeBytes) {
      throw new BadRequestException(
        `${ERROR_MESSAGES.FILE_TOO_LARGE}. Max size: ${this.attachmentsMaxFileSizeBytes / 1024 / 1024}MB`,
      );
    }

    try {
      const normalizedOriginalName = this.normalizeOriginalFileName(
        file.originalname,
      );
      const extension = this.getExtensionFromOriginalName(
        normalizedOriginalName,
      );
      const storageName = `${randomUUID()}${extension}`;
      const filepath = path.join(this.attachmentsUploadsDir, storageName);

      await fs.writeFile(filepath, file.buffer);

      return {
        storageName,
        fileUrl: `${this.attachmentsPublicDir}/${storageName}`,
        mimeType: file.mimetype,
        fileSize: file.size,
        originalName: normalizedOriginalName,
      };
    } catch (error) {
      console.error(`${ERROR_MESSAGES.FAILED_TO_UPLOAD_ATTACHMENT}:`, error);
      throw new InternalServerErrorException(
        ERROR_MESSAGES.FAILED_TO_UPLOAD_ATTACHMENT,
      );
    }
  }

  async deleteAttachment(fileUrl: string): Promise<void> {
    try {
      const storageName = path.basename(fileUrl);
      const filepath = path.join(this.attachmentsUploadsDir, storageName);

      await fs.access(filepath);
      await fs.unlink(filepath);
    } catch (error) {
      console.error('Failed to delete attachment:', error);
    }
  }

  resolveAttachmentAbsolutePath(fileUrl: string): string {
    const storageName = path.basename(fileUrl);
    return path.join(this.attachmentsUploadsDir, storageName);
  }

  getFullAttachmentUrl(fileUrl: string): string {
    const mediaUrl = this.configService.getOrThrow<string>(
      ENV_VARIABLES.MEDIA_URL,
    );
    return `${mediaUrl}${toPublicUrlPath(fileUrl)}`;
  }

  async readAttachmentForDownload(fileUrl: string): Promise<Buffer> {
    const absolutePath = this.resolveAttachmentAbsolutePath(fileUrl);

    try {
      return await fs.readFile(absolutePath);
    } catch {
      throw new NotFoundException(ERROR_MESSAGES.ATTACHMENT_NOT_FOUND);
    }
  }

  private getExtensionFromOriginalName(originalName: string): string {
    const extension = path.extname(originalName).toLowerCase();
    return extension && extension.length <= 10 ? extension : '';
  }

  private isAttachmentTypeAllowed(file: Express.Multer.File): boolean {
    if (this.attachmentsAllowedMimeTypes.includes(file.mimetype)) {
      return true;
    }

    const extension = this.getExtensionFromOriginalName(file.originalname);

    return this.attachmentsAllowedExtensions.has(extension);
  }

  private normalizeOriginalFileName(originalName: string): string {
    const decoded = Buffer.from(originalName, 'latin1').toString('utf8');

    if (
      this.looksLikeMojibake(originalName) &&
      !this.looksLikeMojibake(decoded)
    ) {
      return decoded;
    }

    return originalName;
  }

  private looksLikeMojibake(value: string): boolean {
    return /Ð.|Ñ.|Ã./.test(value);
  }
}
