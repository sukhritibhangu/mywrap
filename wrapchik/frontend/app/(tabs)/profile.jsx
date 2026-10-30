import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Heart, Clock, Shield, HelpCircle, Info, LogOut, ChevronRight } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import COLORS from '../../constants/colors';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAdmin, logout } = useContext(AuthContext);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (e) {
      console.error('[Logout Error]:', e);
    }
  };

  const MENU_OPTIONS = [
    {
      id: 'admin',
      title: '👨‍🍳 Shopkeeper Admin Dashboard',
      icon: Shield,
      route: '/admin/dashboard',
      color: COLORS.primary,
    },
    {
      id: 'favourites',
      title: 'Favourites & Liked Items',
      icon: Heart,
      route: '/favourites',
      color: COLORS.danger,
    },
    {
      id: 'orders',
      title: 'Order History',
      icon: Clock,
      route: '/(tabs)/orders',
      color: COLORS.info,
    },
    {
      id: 'support',
      title: 'Help & Support',
      icon: HelpCircle,
      route: '/support',
      color: COLORS.warning,
    },
  ];

  return (
    <View style={styles.container}>
      <Header title="Profile" showCart={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Info Header Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user?.name || 'Wrapchik Student'}</Text>
              {isAdmin && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>ADMIN</Text>
                </View>
              )}
            </View>
            <Text style={styles.userEmail}>{user?.email || 'student@wrapchik.com'}</Text>
            <Text style={styles.userPhone}>📱 {user?.phone || 'Not set'}</Text>
          </View>
        </View>

        {/* Menu Navigation Group */}
        <View style={styles.menuGroup}>
          {MENU_OPTIONS.filter(option => option.id !== 'admin' || isAdmin).map((item) => {
            const IconComp = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.route)}
                style={styles.menuItem}
              >
                <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                  <IconComp size={20} color={item.color} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <ChevronRight size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* App Info Box */}
        <View style={styles.infoBox}>
          <Info size={18} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>Wrapchik v1.0.0 • Fresh. Fast. Flavorful.</Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Log Out Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.primary,
  },
  userInfo: {
    marginLeft: 14,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  roleBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  menuGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerLight,
    height: 50,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.danger,
  },
});
