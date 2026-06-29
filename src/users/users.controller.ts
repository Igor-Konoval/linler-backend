import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ApiAuth } from 'src/decorators/api-auth.decorator';
import type { AuthUser } from 'src/types/user.type';
import { UsersService } from './users.service';
import { FileService } from 'src/common/services/file.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { UserEntity } from './entities/user.entity';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly fileService: FileService,
  ) {}

  @ApiAuth()
  @UseGuards(AccessTokenGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: AuthUser): Promise<UserProfileDto> {
    const userEntity = await this.usersService.findById(user.id);

    if (!userEntity) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return this.toProfileDto(userEntity);
  }

  @ApiAuth()
  @UseGuards(AccessTokenGuard)
  @Patch('me')
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const updatedUser = await this.usersService.updateProfile(user.id, dto);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      avatarUrl: this.fileService.getFullAvatarUrl(updatedUser.avatarUrl),
    };
  }

  @ApiAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file (max 2MB, jpg/png/webp)',
        },
      },
    },
  })
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  @Post('me/avatar')
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserProfileDto> {
    const currentUser = await this.usersService.findById(user.id);

    if (!currentUser) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (currentUser.avatarUrl) {
      await this.fileService.deleteAvatar(currentUser.avatarUrl);
    }

    const avatarUrl = await this.fileService.uploadAvatar(file);

    const updatedUser = await this.usersService.updateAvatar(
      user.id,
      avatarUrl,
    );

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      avatarUrl: this.fileService.getFullAvatarUrl(updatedUser.avatarUrl),
    };
  }

  @ApiAuth()
  @UseGuards(AccessTokenGuard)
  @Delete('me/avatar')
  async deleteAvatar(@CurrentUser() user: AuthUser): Promise<UserProfileDto> {
    const currentUser = await this.usersService.findById(user.id);

    if (!currentUser) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (currentUser.avatarUrl) {
      await this.fileService.deleteAvatar(currentUser.avatarUrl);
    }

    const updatedUser = await this.usersService.deleteAvatar(user.id);

    return this.toProfileDto(updatedUser);
  }

  private toProfileDto(user: UserEntity): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: this.fileService.getFullAvatarUrl(user.avatarUrl),
    };
  }
}
