import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingBag, Clock, CheckCircle2, IndianRupee, Layers, Package, ArrowRight } from 'lucide-react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import adminService from '../../services/adminService';
import { AuthContext } from '../../context/AuthContext';
import COLORS from '../../constants/colors';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { logout } = useContext(AuthContext);
  const [error, setError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const [res, settingsRes] = await Promise.all([adminService.getAnalytics(), adminService.getSettings()]);
      if (!res?.analytics || !settingsRes?.settings) throw new Error('Unable to load shop data. Please retry.');
      setAnalytics({ ...res.analytics, settings: settingsRes.settings });
    } catch (e) {
      setError(e.message || 'Unable to load shop data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading && !refreshing) {
    return <LoadingIndicator message="Loading shopkeeper dashboard analytics..." />;
  }

  const toggleAcceptingOrders = async () => {
    if (savingSettings || !analytics?.settings) return;
    setSavingSettings(true);
    setError('');
    try {
      const res = await adminService.updateSettings({ acceptingOrders: !analytics.settings.acceptingOrders });
      if (!res?.settings) throw new Error('Unable to save shop settings.');
      setAnalytics(prev => ({ ...prev, settings: res.settings }));
    } catch (e) {
      setError(e.message || 'Unable to save shop settings.');
    } finally {
      setSavingSettings(false);
    }
  };
  if (!analytics) {
    return <View style={{flex:1,padding:24,justifyContent:'center'}}><Text accessibilityRole="alert" style={{color:COLORS.danger,marginBottom:16}}>{error}</Text><Button title="Retry" onPress={fetchAnalytics} /></View>;
  }

  return (
    <View style={styles.container}>
      <Header title="Shopkeeper Admin" showBack showCart={false} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
      >
        {error ? <Text accessibilityRole="alert" style={{color:COLORS.danger,marginBottom:12}}>{error}</Text> : null}
        <Button title="Refresh dashboard" variant="outline" onPress={handleRefresh} loading={refreshing} style={{marginBottom:12}} />
        <View style={styles.quickToggleRow}>
          <Text style={styles.quickToggleText}>Accepting Orders</Text>
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel="Accepting Orders"
            accessibilityState={{checked:!!analytics.settings.acceptingOrders,disabled:savingSettings}}
            disabled={savingSettings}
            activeOpacity={0.8}
            onPress={toggleAcceptingOrders}
            style={[styles.toggleContainer, analytics?.settings?.acceptingOrders ? styles.toggleOn : styles.toggleOff]}
          >
            <View style={[styles.toggleCircle, analytics?.settings?.acceptingOrders ? styles.circleOn : styles.circleOff]} />
          </TouchableOpacity>
        </View>
        {/* Metric Cards Grid */}
        <View style={styles.metricsGrid}>
          {/* Today's Revenue Card */}
          <View style={[styles.metricCard, styles.revenueCard]}>
            <View style={styles.cardHeader}>
              <IndianRupee size={20} color="#FFFFFF" />
              <Text style={styles.revenueBadge}>TODAY</Text>
            </View>
            <Text style={styles.revenueVal}>₹{analytics?.todayRevenue ?? 0}</Text>
            <Text style={styles.revenueSub}>Total Revenue: ₹{analytics?.totalRevenue ?? 0}</Text>
          </View>

          {/* Pending Orders Card */}
          <View style={styles.metricCard}>
            <View style={styles.cardHeader}>
              <Clock size={20} color={COLORS.warning} />
              <Text style={styles.metricVal}>{analytics?.pendingOrders ?? 0}</Text>
            </View>
            <Text style={styles.metricTitle}>Pending Orders</Text>
            <Text style={styles.metricSub}>Requires Action</Text>
          </View>

          {/* Today's Orders Card */}
          <View style={styles.metricCard}>
            <View style={styles.cardHeader}>
              <ShoppingBag size={20} color={COLORS.info} />
              <Text style={styles.metricVal}>{analytics?.todayOrders ?? 0}</Text>
            </View>
            <Text style={styles.metricTitle}>Today's Orders</Text>
            <Text style={styles.metricSub}>Total Placed Today</Text>
          </View>

          {/* Completed Orders Card */}
          <View style={styles.metricCard}>
            <View style={styles.cardHeader}>
              <CheckCircle2 size={20} color={COLORS.success} />
              <Text style={styles.metricVal}>{analytics?.completedOrders ?? 0}</Text>
            </View>
            <Text style={styles.metricTitle}>Completed</Text>
            <Text style={styles.metricSub}>Fulfilled Orders</Text>
          </View>
        </View>

        {/* Quick Management Action List */}
        <Text style={styles.sectionTitle}>Shop Management</Text>

        <TouchableOpacity
          onPress={() => router.push('/admin/orders')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconBox, { backgroundColor: COLORS.warningLight }]}>
            <Clock size={22} color={COLORS.warning} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Manage Live Orders</Text>
            <Text style={styles.actionDesc}>Accept, prepare, and update status of student orders</Text>
          </View>
          <ArrowRight size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/admin/products')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconBox, { backgroundColor: COLORS.primaryLight }]}>
            <Package size={22} color={COLORS.primary} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Product Inventory Manager</Text>
            <Text style={styles.actionDesc}>Add products, change prices & toggle availability</Text>
          </View>
          <ArrowRight size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/admin/categories')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconBox, { backgroundColor: COLORS.infoLight }]}>
            <Layers size={22} color={COLORS.info} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Category Manager</Text>
            <Text style={styles.actionDesc}>Create, update & arrange menu categories</Text>
          </View>
          <ArrowRight size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/admin/tables')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconBox, { backgroundColor: COLORS.warningLight }]}>
            <Layers size={22} color={COLORS.warning} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Table Manager</Text>
            <Text style={styles.actionDesc}>Manage dine-in tables and statuses</Text>
          </View>
          <ArrowRight size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/admin/settings')}
          style={styles.actionCard}
        >
          <View style={[styles.actionIconBox, { backgroundColor: COLORS.primaryLight }]}>
            <Clock size={22} color={COLORS.primary} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Restaurant Settings</Text>
            <Text style={styles.actionDesc}>Toggle orders, update timings, and fees</Text>
          </View>
          <ArrowRight size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Log Out Admin Button */}
        <TouchableOpacity
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
          style={styles.logoutBtn}
        >
          <Text style={styles.logoutBtnText}>🚪 Log Out Admin Account</Text>
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
  quickToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  quickToggleText: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  toggleContainer: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: COLORS.success },
  toggleOff: { backgroundColor: COLORS.border },
  toggleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  circleOn: { transform: [{ translateX: 22 }] },
  circleOff: { transform: [{ translateX: 0 }] },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  revenueCard: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  revenueBadge: {
    color: COLORS.primary,
    backgroundColor: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  revenueVal: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  revenueSub: {
    fontSize: 12,
    color: '#FFE0B2',
    marginTop: 2,
  },
  metricVal: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  metricSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  actionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: COLORS.dangerLight,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.danger,
  },
});
