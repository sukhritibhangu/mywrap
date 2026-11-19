import React, { useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, Clock, Shield, HelpCircle, Info, LogIn, LogOut, ChevronRight, Bell } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import COLORS from '../../constants/colors';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import WrapooWelcome from '../../components/wrapoo/WrapooWelcome';
import useReducedMotion from '../../hooks/useReducedMotion';

/** A quiet, reduced-motion-aware rise for each block on the profile page. */
function Reveal({ children, delay = 0 }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) { progress.setValue(1); return undefined; }
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 360, delay, easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reducedMotion]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAdmin, logout, updateProfile } = useContext(AuthContext);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');

  const performLogout = async () => {
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (e) {
      console.error('[Logout Error]:', e);
      Alert.alert('Could not log out', e?.message || 'Please try again.');
    }
  };

  const handleLogout = () => {
    const message = 'You will need to sign in with Google again to see your orders.';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Log out of Wrapchik?\n\n${message}`)) performLogout();
      return;
    }
    Alert.alert('Log out of Wrapchik?', message, [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: performLogout },
    ]);
  };

  const handleSaveName = async () => {
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 80) {
      setProfileError('Name must be between 1 and 80 characters.');
      return;
    }
    setSaving(true);
    setProfileError('');
    setProfileNotice('');
    const result = await updateProfile({ name: cleanName });
    setSaving(false);
    if (!result?.success) {
      setProfileError(result?.message || 'Could not update your profile.');
      return;
    }
    setEditingName(false);
    setProfileNotice('Name updated.');
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
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      route: '/notifications',
      color: COLORS.secondary,
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
        <WrapooWelcome
          compact
          style={styles.rapoCard}
          title="Rapo says"
          message={user?.name
            ? `Hey ${user.name.trim().split(/\s+/)[0]}! Looking good! Ready for another delicious adventure?`
            : 'Hey! Looking good! Ready for another delicious adventure?'}
        />

        {/* User Info Header Card */}
        <Reveal delay={0}>
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{user?.name ? user.name.charAt(0).toUpperCase() : 'W'}</Text>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user?.name || 'Your profile'}</Text>
              {isAdmin && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>ADMIN</Text>
                </View>
              )}
            </View>
            {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
            {user?.phone ? <Text style={styles.userPhone}>📱 {user.phone}</Text> : null}
            {user?.emailVerified ? <Text style={styles.verifiedText}>Email verified</Text> : user?.phoneVerified ? <Text style={styles.verifiedText}>Phone verified</Text> : null}
          </View>
        </View>
        </Reveal>

        {user ? (
          <Reveal delay={80}>
          <View style={styles.profileEditCard}>
            <View style={styles.profileEditHeader}>
              <Text style={styles.sectionTitle}>Personal details</Text>
              {!editingName ? (
                <TouchableOpacity
                  onPress={() => { setName(user.name || ''); setProfileError(''); setProfileNotice(''); setEditingName(true); }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit name"
                >
                  <Text style={styles.editLink}>Edit name</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {editingName ? (
              <>
                <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" maxLength={80} />
                <View style={styles.editActions}>
                  <Button title="Save name" onPress={handleSaveName} loading={saving} style={styles.saveNameButton} />
                  <TouchableOpacity onPress={() => { setEditingName(false); setName(user.name || ''); setProfileError(''); }} accessibilityRole="button" style={styles.cancelEdit}>
                    <Text style={styles.cancelEditText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
            {profileError ? <Text accessibilityRole="alert" style={styles.profileError}>{profileError}</Text> : null}
            {profileNotice ? <Text accessibilityRole="status" style={styles.profileNotice}>{profileNotice}</Text> : null}
          </View>
          </Reveal>
        ) : null}

        {/* Menu Navigation Group */}
        <Reveal delay={140}>
        <View style={styles.menuGroup}>
          {MENU_OPTIONS.filter((item) => item.id !== 'admin' || isAdmin).map((item) => {
            const IconComp = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.route)}
                style={styles.menuItem}
                accessibilityRole="button"
                accessibilityLabel={item.title}
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
        </Reveal>

        {/* App Info Box */}
        <Reveal delay={200}>
        <View style={styles.infoBox}>
          <Info size={18} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>Wrapchik v1.0.0 • Fresh. Fast. Flavorful.</Text>
        </View>

        {/* Account Action */}
        <TouchableOpacity onPress={user ? handleLogout : () => router.push('/(auth)/login')} style={[styles.logoutBtn, !user && styles.loginBtn]}>
          {user ? <LogOut size={20} color={COLORS.danger} /> : <LogIn size={20} color={COLORS.primary} />}
          <Text style={[styles.logoutText, !user && styles.loginText]}>{user ? 'Log Out Account' : 'Sign In to Wrapchik'}</Text>
        </TouchableOpacity>
        </Reveal>
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
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 28,
  },
  rapoCard: { marginHorizontal: 0, marginTop: 0, marginBottom: 16 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
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
  verifiedText: { color: COLORS.success, fontSize: 12, fontWeight: '700', marginTop: 4 },
  profileEditCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  profileEditHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  editLink: { color: COLORS.primary, fontSize: 13, fontWeight: '800', padding: 8 },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saveNameButton: { flex: 1 },
  cancelEdit: { padding: 12 },
  cancelEditText: { color: COLORS.textSecondary, fontWeight: '700' },
  profileError: { color: COLORS.danger, marginTop: 8, fontSize: 12, fontWeight: '700' },
  profileNotice: { color: COLORS.success, marginTop: 8, fontSize: 12, fontWeight: '700' },
  menuGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 15,
    paddingVertical: 11,
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
    borderRadius: 15,
    gap: 8,
  },
  loginBtn: { backgroundColor: COLORS.primaryLight },
  logoutText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.danger,
  },
  loginText: { color: COLORS.primaryDark },
});
