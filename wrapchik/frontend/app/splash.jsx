import React, { useEffect, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Wrapoo from '../components/wrapoo/Wrapoo';
import { useRouter } from 'expo-router';
import { AuthContext } from '../context/AuthContext';
import COLORS from '../constants/colors';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useContext(AuthContext);

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (isAuthenticated && user) {
        if (user.role === 'admin') {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/(tabs)/home');
        }
      } else {
        router.replace('/(auth)/login');
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, user]);

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Wrapoo size={94} mood="happy" />
      </View>

      <Text style={styles.brandTitle}>WRAPCHIK</Text>
      <Text style={styles.tagline}>Fresh. Fast. A little magical.</Text>
      <Text style={styles.subtext}>Your enchanted campus café</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoCircle: {
    minHeight: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  subtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
});
