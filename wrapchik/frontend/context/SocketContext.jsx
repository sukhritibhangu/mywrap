import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

// Get the API base URL from the same logic used in services/api.js
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getSocketUrl = () => {
  // Same logic as api.js getBaseUrl but without /api prefix
  if (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost') {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${protocol}://${window.location.hostname}:5000`;
  }
  const debuggerHost = Constants.expoGoConfig?.debuggerHost || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  if (debuggerHost) {
        const host = debuggerHost.split(':')[0];
    return `http://${host}:5000`;
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://localhost:5000';
};

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useContext(AuthContext);
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      const socketUrl = getSocketUrl();
      socketRef.current = io(socketUrl, {
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
