import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FileService } from 'src/common/services/file.service';
import { UsersService } from 'src/users/users.service';
import { WorkspacesService } from 'src/workspaces/workspaces.service';
import { AuthService } from './auth.service';
import { UserSessionEntity } from './entities/user-session.entity';
import { AuthTokenService } from './services/auth-token.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: AuthTokenService,
          useValue: {},
        },
        {
          provide: FileService,
          useValue: { getFullAvatarUrl: jest.fn() },
        },
        {
          provide: WorkspacesService,
          useValue: {},
        },
        {
          provide: getRepositoryToken(UserSessionEntity),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
