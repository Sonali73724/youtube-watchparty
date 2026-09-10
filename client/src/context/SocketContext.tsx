import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@watchparty/shared';
import { useAuth } from './AuthContext';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface SocketContextType {
  socket: TypedSocket | null;
  status: ConnectionStatus;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  status: 'disconnected',
});

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setStatus('disconnected');
      }
      return;
    }

    setStatus('connecting');
    
    const SERVER_URL =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_SERVER_URL ||
      (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:4000'
        : 'https://youtube-watchparty-9ep9.onrender.com');

    // Connect to backend server URL
    const newSocket: TypedSocket = io(SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('⚡ Socket.IO connected:', newSocket.id);
      setStatus('connected');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO disconnected:', reason);
      setStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.warn('⚠️ Socket connection error:', error.message);
      setStatus('reconnecting');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket, status }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  return useContext(SocketContext);
};
