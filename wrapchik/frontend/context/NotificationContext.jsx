import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from './AuthContext';
import { SocketContext } from './SocketContext';
import notificationService from '../services/notificationService';

export const NotificationContext = createContext({ unreadCount: 0, refreshUnread: async () => {}, markOneRead: () => {}, markAllRead: () => {} });

export const NotificationProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const { socket, isConnected } = useContext(SocketContext);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventVersionRef = useRef(0);
  const requestVersionRef = useRef(0);
  const seenEventIdsRef = useRef(new Set());

  const refreshUnread = useCallback(async () => {
    if (!user?._id) { setUnreadCount(0); return; }
    const requestVersion = ++requestVersionRef.current;
    const eventVersion = eventVersionRef.current;
    try {
      const response = await notificationService.getMyNotifications({ page: 1, limit: 1 });
      if (requestVersion === requestVersionRef.current && eventVersion === eventVersionRef.current && response?.success) {
        setUnreadCount(Number(response.unreadCount) || 0);
      }
    } catch (error) {
      console.warn('[Notifications] Could not refresh unread count:', error.message);
    }
  }, [user?._id]);

  useEffect(() => {
    setUnreadCount(0);
    seenEventIdsRef.current.clear();
    refreshUnread();
  }, [refreshUnread]);

  useEffect(() => { if (isConnected) refreshUnread(); }, [isConnected, refreshUnread]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleCreated = (notification) => {
      const id = String(notification?.notificationId || '');
      if (!id || seenEventIdsRef.current.has(id)) return;
      seenEventIdsRef.current.add(id);
      if (seenEventIdsRef.current.size > 300) seenEventIdsRef.current.clear();
      eventVersionRef.current += 1;
      setUnreadCount((count) => count + 1);
    };
    socket.on('notification_created', handleCreated);
    return () => socket.off('notification_created', handleCreated);
  }, [socket]);

  const markOneRead = useCallback(() => setUnreadCount((count) => Math.max(0, count - 1)), []);
  const markAllRead = useCallback(() => setUnreadCount(0), []);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread, markOneRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
};
