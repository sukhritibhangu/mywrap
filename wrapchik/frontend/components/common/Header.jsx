import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingBag, ArrowLeft, Shield, Bell } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import COLORS from '../../constants/colors';
import { NotificationContext } from '../../context/NotificationContext';

const Header = ({ title, showBack = false, showCart = true, showNotifications = true }) => {
  const router = useRouter();
  const { cartCount } = useContext(CartContext);
  const { isAdmin } = useContext(AuthContext);
  const { unreadCount } = useContext(NotificationContext);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftContainer}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.brandTitle}>Wrapchik</Text>
        )}
      </View>

      {title ? (
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      ) : null}

      <View style={styles.rightContainer}>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => router.push('/admin/dashboard')}
            style={styles.adminBadgeBtn}
            accessibilityRole="button"
            accessibilityLabel="Open administrator dashboard"
          >
            <Shield size={16} color="#FFFFFF" />
            <Text style={styles.adminBadgeText}>Admin</Text>
          </TouchableOpacity>
        )}

        {showNotifications && (
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.cartBtn} accessibilityRole="button" accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}>
            <Bell size={22} color={COLORS.textPrimary} />
            {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
          </TouchableOpacity>
        )}

        {showCart && (
          <TouchableOpacity onPress={() => router.push('/(tabs)/cart')} style={styles.cartBtn} accessibilityRole="button" accessibilityLabel={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
            <ShoppingBag size={24} color={COLORS.textPrimary} />
            {cartCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: COLORS.background,
    borderBottomWidth: 0,
    maxWidth: 1120,
    width: '100%',
    alignSelf: 'center',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    padding: 6,
  },
  cartBtn: {
    padding: 6,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  adminBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default Header;
