import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserParams } from 'src/types/user.type';
import { ERROR_MESSAGES } from 'src/constants/error.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(params: CreateUserParams): Promise<UserEntity> {
    const existingUser = await this.usersRepository.findOne({
      where: {
        email: params.email,
      },
    });

    if (existingUser) {
      throw new ConflictException(ERROR_MESSAGES.USER_ALREADY_EXISTS);
    }

    const user = this.usersRepository.create({
      avatarUrl: null,
      username: params.username,
      email: params.email,
      passwordHash: params.passwordHash,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({
      where: {
        email,
      },
    });
  }

  async findByEmailWithPassword(email: string): Promise<UserEntity | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({
      where: {
        id,
      },
    });
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserEntity> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    Object.assign(user, dto);

    return this.usersRepository.save(user);
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<UserEntity> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    user.avatarUrl = avatarUrl;

    return this.usersRepository.save(user);
  }

  async deleteAvatar(userId: string): Promise<UserEntity> {
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    user.avatarUrl = null;

    return this.usersRepository.save(user);
  }
}
