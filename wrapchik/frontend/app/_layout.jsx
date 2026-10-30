import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';
import { CartProvider } from '../context/CartContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CartProvider>
          <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="splash" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(auth)/signup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="product/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="payment" />
          <Stack.Screen name="order-confirmation" />
          <Stack.Screen name="order-tracking/[id]" />
          <Stack.Screen name="favourites" />
          <Stack.Screen name="support" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="group-order" />
          <Stack.Screen name="report-issue" />
        </Stack>
        </CartProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
