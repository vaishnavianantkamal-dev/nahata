import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // In production use the Render API URL; in dev use proxy
    const apiUrl = (import.meta as any).env?.VITE_API_URL || '';
    socket = io(apiUrl || '/', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
