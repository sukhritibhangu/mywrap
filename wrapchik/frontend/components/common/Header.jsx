import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingBag, ArrowLeft, Shield, Bell, Sparkles } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import { NotificationContext } from '../../context/NotificationContext';
import { useFlyToCart } from '../../context/FlyToCartContext';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const Header = ({ title, showBack = false, showCart = true, showNotifications = true }) => {
  const router = useRouter();
  const { cartCount } = useContext(CartContext);
  const { isAdmin } = useContext(AuthContext);
  const { unreadCount } = useContext(NotificationContext);
  const { landCount } = useFlyToCart();
  const reducedMotion = useReducedMotion();
  const cartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!landCount || reducedMotion) return;
    cartScale.setValue(0.86);
    Animated.sequence([
      Animated.spring(cartScale, { toValue: 1.28, friction: 3, tension: 180, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(cartScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [cartScale, landCount, reducedMotion]);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftContainer}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <ArrowLeft size={23} color={COLORS.cocoa} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/home')}
            accessibilityRole="button"
            accessibilityLabel="Wrapchik home"
            style={styles.brandRow}
          >
            <Text style={styles.brandTitle}>Wrapchik</Text>
            <View style={styles.brandSpark}><Sparkles size={11} color={COLORS.goldDeep} /></View>
          </TouchableOpacity>
        )}
      </View>

      {title ? (
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      ) : null}

      <View style={styles.rightContainer}>
        {isAdmin ? (
          <TouchableOpacity
            onPress={() => router.push('/admin/dashboard')}
            style={styles.adminBadgeBtn}
            accessibilityRole="button"
            accessibilityLabel="Open administrator dashboard"
          >
            <Shield size={14} color={COLORS.cocoa} />
            <Text style={styles.adminBadgeText}>Admin</Text>
          </TouchableOpacity>
        ) : null}

        {showNotifications ? (
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            hitSlop={6}
          >
            <Bell size={22} color={COLORS.cocoa} />
            {unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}
          </TouchableOpacity>
        ) : null}

        {showCart ? (
          <Animated.View style={{ transform: [{ scale: cartScale }] }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/cart')}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}
              hitSlop={6}
            >
              <ShoppingBag size={23} color={COLORS.cocoa} />
              {cartCount > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View>
              ) : null}
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(235, 220, 198, 0.7)',
    maxWidth: 1120,
    width: '100%',
    alignSelf: 'center',
  },
  leftContainer: { flexDirection: 'row', alignItems: 'center', minWidth: 44 },
  brandRow: { flexDirection: 'row', alignItems: 'flex-start' },
  brandTitle: { fontSize: 23, fontWeight: '900', color: COLORS.primaryDark, letterSpacing: 0.2 },
  brandSpark: { marginLeft: 2, marginTop: 1 },
  headerTitle: {
    fontSize: 17, fontWeight: '800', color: COLORS.textPrimary,
    textAlign: 'center', flex: 1, paddingHorizontal: 8,
  },
  rightContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { padding: 8, minWidth: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: {
    position: 'absolute', top: 3, right: 3, backgroundColor: COLORS.primary,
    borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 4,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.background,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  adminBadgeBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.goldLight,
    paddingHorizontal: 10, minHeight: 32, borderRadius: THEME.radius.pill, gap: 4,
    borderWidth: 1, borderColor: COLORS.gold,
  },
  adminBadgeText: { color: COLORS.cocoa, fontSize: 11.5, fontWeight: '800' },
});

export default Header;
