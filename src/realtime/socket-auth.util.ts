import type { Socket } from 'socket.io';
import type { SocketAuthData } from './realtime.types';

export function getSocketAuth(socket: Socket): SocketAuthData {
  return socket.data as SocketAuthData;
}

export function patchSocketAuth(
  socket: Socket,
  patch: Partial<SocketAuthData>,
): SocketAuthData {
  const next: SocketAuthData = {
    ...getSocketAuth(socket),
    ...patch,
  };
  socket.data = next;
  return next;
}
