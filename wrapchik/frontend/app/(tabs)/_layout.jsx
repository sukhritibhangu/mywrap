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
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: '#FFFFFF',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          elevation: 12,
          shadowColor: '#1F2937',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          maxWidth: 1120,
          width: '100%',
          alignSelf: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
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
            fontSize: 10,
            fontWeight: '800',
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
