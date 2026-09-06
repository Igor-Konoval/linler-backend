import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import { ENV_VARIABLES } from 'src/constants/env.constants';
import { REALTIME_SOCKET_PATH } from './realtime.constants';

export class RealtimeIoAdapter extends IoAdapter {
  constructor(private readonly nestApp: INestApplicationContext) {
    super(nestApp);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const origin = this.nestApp
      .get(ConfigService)
      .get<string>(ENV_VARIABLES.FRONTEND_URL, 'http://localhost:3000');
    const previousCors =
      options?.cors && typeof options.cors === 'object' ? options.cors : {};

    const server = super.createIOServer(port, {
      ...options,
      path: REALTIME_SOCKET_PATH,
      cors: {
        ...previousCors,
        origin,
        credentials: true,
      },
    }) as Server;

    return server;
  }
}
