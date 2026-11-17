import React from 'react';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';
import { CartProvider } from '../context/CartContext';
import { CompanionProvider } from '../context/CompanionContext';
import { FlyToCartProvider } from '../context/FlyToCartContext';
import { NotificationProvider } from '../context/NotificationContext';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AdminRouteGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading } = React.useContext(AuthContext);
  useEffect(() => {
    if (isLoading) return;
    if (segments[0] === 'admin' && user?.role !== 'admin') {
      router.replace('/(auth)/login');
    }
  }, [isLoading, router, segments, user?.role]);
  return null;
}

function PushNotificationBridge() {
  const router = useRouter();
  const { user, isLoading } = React.useContext(AuthContext);
  const lastResponseId = useRef(null);
  useEffect(() => {
    if (Platform.OS === 'web' || isLoading) return undefined;
    const navigateFromResponse = (response) => {
      const responseId = response?.notification?.request?.identifier;
      if (!responseId || lastResponseId.current === responseId) return;
      lastResponseId.current = responseId;
      Notifications.clearLastNotificationResponseAsync().catch((error) => console.warn('[Push Navigation] Could not clear launch response:', error.message));
      const data = response.notification.request.content.data || {};
      if (user?.role === 'admin') router.push('/admin/orders');
      else if (typeof data.orderId === 'string') router.push(`/order-tracking/${data.orderId}`);
      else router.push('/notifications');
    };
    Notifications.getLastNotificationResponseAsync().then(navigateFromResponse).catch((error) => console.warn('[Push Navigation] Could not read launch response:', error.message));
    const subscription = Notifications.addNotificationResponseReceivedListener(navigateFromResponse);
    return () => subscription.remove();
  }, [router, user?.role, isLoading]);
  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
        <CartProvider>
        <CompanionProvider>
        <FlyToCartProvider>
          <StatusBar style="dark" />
        <PushNotificationBridge />
        <AdminRouteGuard />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="splash" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(auth)/signup" />
          <Stack.Screen name="(auth)/email-verification" />
          <Stack.Screen name="(auth)/forgot-password" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="product/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="payment" />
          <Stack.Screen name="order-confirmation" />
          <Stack.Screen name="order-tracking/[id]" />
          <Stack.Screen name="favourites" />
          <Stack.Screen name="support" />
          <Stack.Screen name="admin/dashboard" />
          <Stack.Screen name="admin/orders" />
          <Stack.Screen name="admin/products" />
          <Stack.Screen name="admin/categories" />
          <Stack.Screen name="admin/tables" />
          <Stack.Screen name="admin/settings" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="group-order" />
          <Stack.Screen name="report-issue" />
          <Stack.Screen name="admin/issues" />
        </Stack>
        </FlyToCartProvider>
        </CompanionProvider>
        </CartProvider>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
