import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { Repository } from 'typeorm';
import { CreateUserParams } from 'src/types/user.type';
import { ERROR_MESSAGES } from 'src/constants/error.constants';

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
}
