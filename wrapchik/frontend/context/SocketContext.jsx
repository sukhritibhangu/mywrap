import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { API_BASE_URL } from '../services/api';

// Keep realtime on the same host as the REST API. Deriving it from the page
// hostname points production web at the frontend's host on port 5000.
const SOCKET_URL = API_BASE_URL.replace(/\/api$/, '');

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useContext(AuthContext);
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      socketRef.current = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
      });

      socketRef.current.on('connect', () => {
        console.log('[Socket.IO] Connected');
        setIsConnected(true);
      });

      socketRef.current.on('connect_error', (error) => {
        console.warn('[Socket.IO] Connection failed:', error.message);
        setIsConnected(false);
      });

      socketRef.current.on('disconnect', () => {
        console.log('[Socket.IO] Disconnected');
        setIsConnected(false);
      });

      return () => {
        socketRef.current?.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      };
    } else {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    }
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
