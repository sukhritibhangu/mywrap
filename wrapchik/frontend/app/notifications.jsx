import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Header from '../components/common/Header';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingIndicator from '../components/common/LoadingIndicator';
import notificationService from '../services/notificationService';
import COLORS from '../constants/colors';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { NotificationContext } from '../context/NotificationContext';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const { markOneRead: decreaseUnread, markAllRead: clearUnread } = useContext(NotificationContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const pagingRef = useRef(false);
  const readRequestsRef = useRef(new Set());

  const fetchNotifications = async ({ append = false } = {}) => {
    if (!user?._id) return;
    if (append && pagingRef.current) return;
    if (append) { pagingRef.current = true; setLoadingMore(true); }
    try {
      const page = append ? pageRef.current + 1 : 1;
      const res = await notificationService.getMyNotifications({ page, limit: 20 });
      if (!res?.success || !Array.isArray(res.notifications)) throw new Error('Notifications could not be loaded.');
      setNotifications((current) => append
        ? [...current, ...res.notifications.filter((notification) => !current.some((existing) => existing._id === notification._id))]
        : res.notifications);
      pageRef.current = page;
      setHasMore(page * (Number(res.limit) || 20) < (Number(res.total) || 0));
      setLoadError(false);
    } catch (error) {
      console.warn('Failed to load notifications:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      pagingRef.current = false;
    }
  };

  useEffect(() => {
    setNotifications([]);
    pageRef.current = 1;
    if (!authLoading && user) { setLoading(true); fetchNotifications(); }
    else if (!authLoading) setLoading(false);
  }, [authLoading, user?._id]);

  useEffect(() => {
    if (!socket || !user) return undefined;
    const refresh = () => fetchNotifications();
    socket.on('notification_created', refresh);
    socket.on('connect', refresh);
    return () => { socket.off('notification_created', refresh); socket.off('connect', refresh); };
  }, [socket, user?._id]);

  const onRefresh = () => {
    pageRef.current = 1;
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (id, notification) => {
    if (!notification.read && !readRequestsRef.current.has(id)) {
      readRequestsRef.current.add(id);
      try {
        const response = await notificationService.markAsRead(id);
        if (!response?.success) throw new Error(response?.message || 'Read status was not saved.');
        setNotifications(current => current.map(n => n._id === id ? { ...n, read: true } : n));
        decreaseUnread();
      } catch (e) {
        Alert.alert('Could not update notification', e?.message || 'Please try again.');
      } finally {
        readRequestsRef.current.delete(id);
      }
    }
    
    if (notification.type === 'ORDER_UPDATE' && notification.orderId) {
      router.push(user?.role === 'admin' ? '/admin/orders' : `/order-tracking/${notification.orderId}`);
    }
  };

  const markAllRead = async () => {
    try {
      const response = await notificationService.markAllRead();
      if (!response?.success) throw new Error(response?.message || 'Notifications were not updated.');
      setNotifications(current => current.map(n => ({ ...n, read: true })));
      clearUnread();
    } catch (e) {
      Alert.alert('Could not update notifications', e?.message || 'Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Notifications" showBack showCart={false} showNotifications={false} />
      
      {user && !loading && !loadError && notifications.length > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead} accessibilityRole="button">
          <Text style={styles.markAllText}>Mark All Read</Text>
        </TouchableOpacity>
      )}

      {authLoading ? (
        <LoadingIndicator message="Restoring your session…" />
      ) : !user ? (
        <EmptyState title="Sign in to view notifications" message="Order updates are delivered to your Wrapchik account." buttonTitle="Sign in" onButtonPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: 'notifications' } })} />
      ) : loadError && !loading ? (
        <ErrorState title="Could not load notifications" message="Retry to check for new order updates." onRetry={onRefresh} retrying={refreshing} />
      ) : loading ? (
        <LoadingIndicator message="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No Notifications"
          message="You are all caught up!"
        />
      ) : (
        <FlatList
          data={notifications}
          onEndReached={() => { if (hasMore) fetchNotifications({ append: true }); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <Text style={styles.footerLoading}>Loading more…</Text> : null}
          keyExtractor={item => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notificationCard, !item.read && styles.unreadCard]}
              onPress={() => markAsRead(item._id, item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.read ? 'Read' : 'Unread'} notification: ${item.title}`}
            >
              {!item.read && <View style={styles.unreadDot} />}
              <View style={styles.content}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  markAllBtn: { padding: 12, marginHorizontal: 16, alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  markAllText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  list: { padding: 16, maxWidth: 780, width: '100%', alignSelf: 'center' },
  notificationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 17,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  unreadCard: {
    backgroundColor: COLORS.primaryLight,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 12,
  },
  content: { flex: 1 },
  title: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  message: { color: COLORS.textSecondary, marginBottom: 8 },
  time: { fontSize: 12, color: '#aaa' },
  footerLoading: { color: COLORS.textSecondary, textAlign: 'center', padding: 14, fontSize: 12 },
});
