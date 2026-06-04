import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { env } from '../config/env';
import { logger } from './logger';

let io: SocketServer;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.APP_BASE_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket connected');

    socket.on('subscribe:lead', (leadId: string) => {
      socket.join(`lead:${leadId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function emitToAll(event: string, data: unknown) {
  if (io) io.emit(event, data);
}

export function emitToLead(leadId: string, event: string, data: unknown) {
  if (io) io.to(`lead:${leadId}`).emit(event, data);
}
