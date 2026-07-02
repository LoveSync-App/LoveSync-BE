import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class LocationRealtimeService {
  private server?: Server;

  bindServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`users:${userId}`).emit(event, payload);
  }
}
