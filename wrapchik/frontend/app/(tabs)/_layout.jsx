import React, { useContext } from 'react';
import { Tabs } from 'expo-router';
import { Home, ShoppingBag, Clock, User } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import COLORS from '../../constants/colors';

export default function TabLayout() {
  const { cartCount } = useContext(CartContext);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primaryDark,
        tabBarInactiveTintColor: COLORS.cocoaMuted,
        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: COLORS.parchment,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          elevation: 14,
          shadowColor: '#5A3620',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
          maxWidth: 1120,
          width: '100%',
          alignSelf: 'center',
        },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.primary,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '900',
          },
          tabBarIcon: ({ color, size }) => <ShoppingBag size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
