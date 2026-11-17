import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShoppingBag, Clock, CheckCircle2, IndianRupee, Layers, Package,
  ArrowRight, ChefHat, Settings, Utensils, Tag, ChevronDown,
} from 'lucide-react-native';
import Header from '../../components/common/Header';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import AdminReveal from '../../components/admin/AdminReveal';
import adminService from '../../services/adminService';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';

const currency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const ADMIN_LINKS = [
  [ChefHat, 'Kitchen & orders', 'Review orders and verify UPI payments', '/admin/orders'],
  [Package, 'Menu products', 'Prices, customisations and availability', '/admin/products'],
  [Layers, 'Categories', 'Organise the outlet menu', '/admin/categories'],
  [Tag, 'Coupons & offers', 'Eligibility, dates and usage limits', '/admin/coupons'],
  [Utensils, 'Dine-in tables', 'Tables and current availability', '/admin/tables'],
  [Settings, 'Store settings', 'Hours, fulfilment, UPI QR and preparation', '/admin/settings'],
];

function TrendBar({ percent }) {
  const reducedMotion = useReducedMotion();
  const target = Math.max(2, Math.min(100, Number(percent) || 0));
  const width = useRef(new Animated.Value(reducedMotion ? target : 0)).current;

  useEffect(() => {
    if (reducedMotion) { width.setValue(target); return undefined; }
    const animation = Animated.timing(width, {
      toValue: target, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, target, width]);

  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[styles.bar, { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}
      />
    </View>
  );
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { logout } = useContext(AuthContext);
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      setError('');
      const [analyticsResult, settingsResult] = await Promise.all([
        adminService.getAnalytics({ period }),
        api.get('/settings'),
      ]);
      if (!analyticsResult?.success || !analyticsResult.analytics || !settingsResult?.settings) {
        throw new Error('Dashboard data is incomplete.');
      }
      setAnalytics(analyticsResult.analytics);
      setSettings(settingsResult.settings);
    } catch (fetchError) {
      setError(fetchError.message || 'Could not load the dashboard. Check your connection and access.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { setLoading(true); fetchOverview(); }, [fetchOverview]);

  const toggleAcceptingOrders = async () => {
    if (!settings || saving) return;
    const next = !settings.acceptingOrders;
    setSaving(true);
    try {
      const response = await adminService.updateSettings({ acceptingOrders: next });
      setSettings(response?.settings || { ...settings, acceptingOrders: next });
    } catch (updateError) {
      setError(updateError.message || 'Could not update order acceptance.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !analytics) return <LoadingIndicator message="Loading shop dashboard…" />;

  const paymentCount = (status) => analytics?.paymentBreakdown?.find((row) => row._id === status)?.count || 0;
  const orderCount = (status) => analytics?.statusBreakdown?.find((row) => row._id === status)?.count || 0;
  const returning = analytics?.customerRepeatStats || { uniqueCustomers: 0, returningCustomers: 0 };
  const peakHour = analytics?.ordersByHour?.[0];
  const pendingPayments = paymentCount('PENDING');
  const recentOrders = analytics?.recentOrders || [];

  const alerts = [];
  if (analytics?.unavailableProducts > 0) {
    alerts.push({
      key: 'menu',
      text: `${analytics.unavailableProducts} menu item${analytics.unavailableProducts === 1 ? '' : 's'} currently unavailable`,
      path: '/admin/products',
      tone: 'danger',
    });
  }
  if (pendingPayments > 0) {
    alerts.push({
      key: 'payments',
      text: `${pendingPayments} order payment${pendingPayments === 1 ? '' : 's'} pending confirmation`,
      path: '/admin/orders',
      tone: 'warning',
    });
  }

  const metric = (label, value, detail, Icon, color, delay) => (
    <AdminReveal key={label} delay={delay} style={styles.metricCell}>
      <View style={styles.metricCard}>
        <View style={styles.metricTop}>
          <View style={[styles.iconBox, { backgroundColor: `${color}18` }]}><Icon size={17} color={color} /></View>
          <Text style={styles.metricValue}>{value}</Text>
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricDetail}>{detail}</Text>
      </View>
    </AdminReveal>
  );

  const trendChart = (title, rows, valueKey, formatter) => {
    const maximum = Math.max(1, ...(rows || []).map((row) => Number(row[valueKey] || 0)));
    return (
      <View style={styles.insightBlock}>
        <Text style={styles.insightTitle}>{title}</Text>
        {rows?.length ? rows.map((row) => (
          <View key={row._id} style={styles.trendRow}>
            <Text style={styles.trendLabel}>
              {valueKey === 'orders' && /^\d+$/.test(String(row._id)) ? `${String(row._id).padStart(2, '0')}:00` : String(row._id).slice(5)}
            </Text>
            <TrendBar percent={Number(row[valueKey] || 0) / maximum * 100} />
            <Text style={styles.trendValue}>{formatter(row[valueKey] || 0)}</Text>
          </View>
        )) : <Text style={styles.muted}>No data for this period.</Text>}
      </View>
    );
  };

  const detailRow = (label, value) => (
    <View style={styles.detailRow} key={label}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Operations" showBack showCart={false} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOverview(); }} colors={[COLORS.primary]} />}
      >
        {!!error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); fetchOverview(); }}>
              <Text style={styles.retry}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <AdminReveal delay={0}>
          <View style={styles.pageIntro}>
            <View style={{ flex: 1, minWidth: 190 }}>
              <Text style={styles.eyebrow}>ADMINISTRATION · TIET PATIALA</Text>
              <Text style={styles.pageTitle}>Today at a glance</Text>
            </View>
            <TouchableOpacity
              disabled={!settings || saving}
              onPress={toggleAcceptingOrders}
              style={[styles.acceptChip, settings?.acceptingOrders ? styles.acceptOn : styles.acceptOff]}
              accessibilityRole="button"
              accessibilityLabel={settings?.acceptingOrders ? 'Pause new orders' : 'Resume new orders'}
            >
              <View style={[styles.dot, settings?.acceptingOrders ? styles.dotOn : styles.dotOff]} />
              <Text style={styles.acceptText}>
                {settings ? (settings.acceptingOrders ? 'Accepting orders' : 'Orders paused') : 'Settings unavailable'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.periodRow}>
            {[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setPeriod(value)}
                style={[styles.periodChip, period === value && styles.periodSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: period === value }}
              >
                <Text style={[styles.periodText, period === value && styles.periodTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </AdminReveal>

        {analytics ? (
          <>
            <AdminReveal delay={60}>
              <View style={styles.revenuePanel}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.revenueCaption}>
                    PAID REVENUE · {period === 'today' ? 'TODAY' : period === '7d' ? 'LAST 7 DAYS' : 'LAST 30 DAYS'}
                  </Text>
                  <Text style={styles.revenueAmount}>{currency(period === 'today' ? analytics.todayRevenue : analytics.periodRevenue)}</Text>
                  <Text style={styles.revenueSub}>
                    {analytics.periodOrders} orders in this period · all-time paid {currency(analytics.totalRevenue)}
                  </Text>
                </View>
                <IndianRupee size={23} color={COLORS.goldLight} />
              </View>
            </AdminReveal>

            <View style={styles.metricsGrid}>
              {metric('Orders today', analytics.todayOrders, 'All payment states', ShoppingBag, COLORS.cocoa, 100)}
              {metric('Awaiting acceptance', orderCount('PLACED'), 'New orders', Clock, COLORS.warning, 145)}
              {metric('In preparation', orderCount('PREPARING'), 'Kitchen queue', ChefHat, COLORS.primaryDark, 190)}
              {metric('Ready for pickup', orderCount('READY'), 'Awaiting collection', CheckCircle2, COLORS.success, 235)}
            </View>

            {alerts.length ? (
              <AdminReveal delay={300}>
                <View style={styles.alertCard}>
                  <Text style={styles.sectionTitle}>Needs attention</Text>
                  {alerts.map((alert) => (
                    <TouchableOpacity key={alert.key} onPress={() => router.push(alert.path)} style={styles.alertRow}>
                      <Text style={alert.tone === 'danger' ? styles.alertMark : styles.alertMarkAmber}>!</Text>
                      <Text style={styles.alertText}>{alert.text}</Text>
                      <ArrowRight size={15} color={COLORS.cocoaMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </AdminReveal>
            ) : null}

            <AdminReveal delay={350}>
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Recent orders</Text>
                  <TouchableOpacity onPress={() => router.push('/admin/orders')} accessibilityRole="button">
                    <Text style={styles.linkText}>View all</Text>
                  </TouchableOpacity>
                </View>
                {recentOrders.length ? recentOrders.slice(0, 4).map((order) => (
                  <TouchableOpacity key={order._id} onPress={() => router.push('/admin/orders')} style={styles.orderRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.orderTitle} numberOfLines={1}>
                        #{order.orderNumber} · {order.customerSnapshot?.name || 'Customer'}
                      </Text>
                      <Text style={styles.orderMeta} numberOfLines={1}>
                        {order.orderType || 'TAKEAWAY'} · {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {order.paymentStatus || 'PENDING'}
                      </Text>
                    </View>
                    <Text style={styles.orderAmount}>{currency(order.totalAmount)}</Text>
                  </TouchableOpacity>
                )) : <Text style={styles.muted}>No orders recorded for this view yet.</Text>}
              </View>
            </AdminReveal>

            <AdminReveal delay={400}>
              <Text style={styles.sectionHeading}>Manage outlet</Text>
              <View style={styles.manageCard}>
                {ADMIN_LINKS.map(([Icon, title, subtitle, path], index) => (
                  <TouchableOpacity
                    key={title}
                    activeOpacity={0.78}
                    onPress={() => router.push(path)}
                    style={[styles.actionRow, index > 0 && styles.actionDivider]}
                    accessibilityRole="button"
                    accessibilityLabel={`${title}. ${subtitle}`}
                  >
                    <View style={styles.actionIcon}><Icon size={19} color={COLORS.primary} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.actionTitle}>{title}</Text>
                      <Text style={styles.actionSub} numberOfLines={1}>{subtitle}</Text>
                    </View>
                    <ArrowRight size={17} color={COLORS.cocoaMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </AdminReveal>

            <AdminReveal delay={450}>
              <TouchableOpacity
                onPress={() => setInsightsOpen((open) => !open)}
                style={styles.insightsToggle}
                accessibilityRole="button"
                accessibilityState={{ expanded: insightsOpen }}
                accessibilityLabel={insightsOpen ? 'Hide detailed insights' : 'Show detailed insights'}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.insightsTitle}>Detailed insights</Text>
                  <Text style={styles.insightsSub}>Payments, trends and menu performance</Text>
                </View>
                <View style={{ transform: [{ rotate: insightsOpen ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={20} color={COLORS.cocoaMuted} />
                </View>
              </TouchableOpacity>
            </AdminReveal>

            {insightsOpen ? (
              <AdminReveal delay={0}>
                <View style={styles.insightsCard}>
                  <View style={[styles.insightBlock, styles.insightBlockFirst]}>
                    <Text style={styles.insightTitle}>More numbers</Text>
                    {detailRow('Completed orders', analytics.completedOrders)}
                    {detailRow('Menu availability', `${analytics.availableProducts}/${analytics.totalProducts} · ${analytics.unavailableProducts} unavailable`)}
                    {detailRow('Average paid order', `${currency(analytics.averageOrderValue)} · ${analytics.paidOrderCount} paid`)}
                    {detailRow('Returning customers', `${returning.returningCustomers}/${returning.uniqueCustomers} · 2+ paid orders`)}
                    {detailRow('Peak ordering hour', peakHour ? `${String(peakHour._id).padStart(2, '0')}:00 · ${peakHour.orders} orders` : 'No orders in range')}
                  </View>

                  {trendChart('Paid revenue trend', analytics.revenueTrend, 'amount', currency)}
                  {trendChart('Order volume trend', analytics.orderVolumeTrend, 'orders', (value) => `${value} orders`)}

                  <View style={styles.insightBlock}>
                    <Text style={styles.insightTitle}>Payments</Text>
                    {detailRow('Paid', paymentCount('SUCCESS'))}
                    {detailRow('Pending', pendingPayments)}
                    {detailRow('Failed', paymentCount('FAILED'))}
                  </View>

                  <View style={styles.insightBlock}>
                    <Text style={styles.insightTitle}>Order outcomes</Text>
                    {detailRow('Cancelled', `${analytics.cancelledOrders} · ${analytics.cancellationRate}%`)}
                    {detailRow('Rejected', `${analytics.rejectedOrders} · ${analytics.rejectionRate}%`)}
                    <Text style={styles.insightNote}>Rates use all orders created in this date range as the denominator.</Text>
                  </View>

                  <View style={styles.insightBlock}>
                    <Text style={styles.insightTitle}>Payment methods</Text>
                    {analytics.paymentMethodBreakdown?.length
                      ? analytics.paymentMethodBreakdown.map((row) => detailRow(
                        `${row._id.method || 'Unknown'} · ${row._id.status || 'Unknown'}`,
                        row.count,
                      ))
                      : <Text style={styles.muted}>No payment records in this period.</Text>}
                  </View>

                  <View style={styles.insightBlock}>
                    <Text style={styles.insightTitle}>Fulfilment</Text>
                    {analytics.ordersByType?.length
                      ? analytics.ordersByType.map((row) => detailRow(row._id || 'Unknown', row.count))
                      : <Text style={styles.muted}>No orders in this period.</Text>}
                  </View>

                  <View style={styles.insightBlock}>
                    <Text style={styles.insightTitle}>Popular items</Text>
                    {analytics.popularProducts?.length
                      ? analytics.popularProducts.map((item) => detailRow(item.name || 'Menu item', `${item.totalQuantity} sold`))
                      : <Text style={styles.muted}>No paid item sales recorded for this period.</Text>}
                  </View>

                  <View style={styles.insightBlock}>
                    <Text style={styles.insightTitle}>Coupon performance</Text>
                    {analytics.couponPerformance?.length
                      ? analytics.couponPerformance.map((row) => detailRow(`${row._id} · ${row.orders} orders`, `${currency(row.discountAmount)} off`))
                      : <Text style={styles.muted}>No paid coupon orders recorded for this period.</Text>}
                  </View>
                </View>
              </AdminReveal>
            ) : null}
          </>
        ) : null}

        <TouchableOpacity onPress={async () => { await logout(); router.replace('/(auth)/login'); }} style={styles.logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 18, paddingBottom: 38, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  pageIntro: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: 10, marginTop: 2, marginBottom: 14,
  },
  eyebrow: { color: COLORS.goldDeep, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3 },
  pageTitle: { fontSize: 26, fontWeight: '900', color: COLORS.cocoa, marginTop: 4, letterSpacing: -0.3 },
  acceptChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 999, borderWidth: 1,
  },
  acceptOn: { backgroundColor: COLORS.successLight, borderColor: 'rgba(61,122,74,0.25)' },
  acceptOff: { backgroundColor: COLORS.dangerLight, borderColor: 'rgba(185,58,43,0.22)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: COLORS.success },
  dotOff: { backgroundColor: COLORS.danger },
  acceptText: { fontSize: 11.5, fontWeight: '800', color: COLORS.textSecondary },
  periodRow: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  periodChip: {
    paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, backgroundColor: COLORS.cardBackground,
    borderWidth: 1, borderColor: COLORS.border,
  },
  periodSelected: { backgroundColor: COLORS.cocoa, borderColor: COLORS.cocoa },
  periodText: { color: COLORS.textSecondary, fontSize: 11.5, fontWeight: '700' },
  periodTextSelected: { color: COLORS.textInverse },

  revenuePanel: {
    backgroundColor: COLORS.cocoa, padding: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(217,164,65,0.45)',
  },
  revenueCaption: { color: COLORS.goldLight, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1 },
  revenueAmount: { color: COLORS.textInverse, fontSize: 30, fontWeight: '900', marginTop: 4 },
  revenueSub: { color: COLORS.creamDeep, fontSize: 11.5, lineHeight: 16, marginTop: 4 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCell: { flexGrow: 1, flexBasis: 148, minWidth: 140 },
  metricCard: {
    backgroundColor: COLORS.cardBackground, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 18, padding: 14, minHeight: 114, justifyContent: 'space-between',
  },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  iconBox: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: COLORS.cocoa, fontWeight: '900', fontSize: 22 },
  metricLabel: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 12, marginTop: 10 },
  metricDetail: { color: COLORS.cocoaMuted, fontSize: 10.5, marginTop: 2 },

  section: {
    backgroundColor: COLORS.cardBackground, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 18, padding: 15, marginTop: 12,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { color: COLORS.cocoa, fontSize: 14.5, fontWeight: '900' },
  linkText: { color: COLORS.primaryDark, fontSize: 11.5, fontWeight: '900' },
  sectionHeading: { color: COLORS.cocoa, fontSize: 16, fontWeight: '900', marginTop: 22, marginBottom: 9 },
  muted: { color: COLORS.cocoaMuted, fontSize: 12, lineHeight: 18 },

  alertCard: {
    backgroundColor: COLORS.cardBackground, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 18, padding: 15, marginTop: 12,
  },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  alertMark: {
    color: COLORS.danger, backgroundColor: COLORS.dangerLight, fontWeight: '900', textAlign: 'center',
    width: 19, height: 19, borderRadius: 10, overflow: 'hidden', lineHeight: 19, fontSize: 11,
  },
  alertMarkAmber: {
    color: COLORS.warning, backgroundColor: COLORS.warningLight, fontWeight: '900', textAlign: 'center',
    width: 19, height: 19, borderRadius: 10, overflow: 'hidden', lineHeight: 19, fontSize: 11,
  },
  alertText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, lineHeight: 17 },

  orderRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12,
  },
  orderTitle: { color: COLORS.textPrimary, fontSize: 12.5, fontWeight: '800' },
  orderMeta: { color: COLORS.cocoaMuted, fontSize: 10.5, marginTop: 3 },
  orderAmount: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 12.5 },

  manageCard: {
    backgroundColor: COLORS.cardBackground, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 18, overflow: 'hidden',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  actionDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  actionIcon: {
    width: 34, height: 34, backgroundColor: COLORS.primaryLight, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { color: COLORS.textPrimary, fontSize: 12.5, fontWeight: '800' },
  actionSub: { color: COLORS.cocoaMuted, fontSize: 10.5, marginTop: 2 },

  insightsToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14,
    backgroundColor: COLORS.cardBackground, borderColor: COLORS.border, borderWidth: 1, borderRadius: 18,
  },
  insightsTitle: { color: COLORS.cocoa, fontSize: 13.5, fontWeight: '900' },
  insightsSub: { color: COLORS.cocoaMuted, fontSize: 10.5, marginTop: 2 },
  insightsCard: {
    backgroundColor: COLORS.cardBackground, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 18, marginTop: 10, overflow: 'hidden',
  },
  insightBlock: { padding: 15, borderTopWidth: 1, borderTopColor: COLORS.border },
  insightBlockFirst: { borderTopWidth: 0 },
  insightTitle: { color: COLORS.cocoa, fontSize: 13, fontWeight: '900', marginBottom: 7 },
  insightNote: { color: COLORS.cocoaMuted, fontSize: 10.5, lineHeight: 15, marginTop: 7 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  detailLabel: { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
  detailValue: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  trendLabel: { width: 48, color: COLORS.cocoaMuted, fontSize: 10 },
  barTrack: { flex: 1, height: 7, backgroundColor: COLORS.surfaceMuted, borderRadius: 5, overflow: 'hidden' },
  bar: { height: 7, backgroundColor: COLORS.primary, borderRadius: 5 },
  trendValue: { width: 72, textAlign: 'right', color: COLORS.textSecondary, fontSize: 10, fontWeight: '700' },

  logout: { padding: 16, alignItems: 'center', marginTop: 6 },
  logoutText: { color: COLORS.danger, fontSize: 12.5, fontWeight: '800' },
  errorBox: {
    backgroundColor: COLORS.dangerLight, borderColor: 'rgba(185,58,43,0.22)', borderWidth: 1,
    padding: 12, borderRadius: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
  },
  errorText: { color: COLORS.danger, fontSize: 12, flex: 1, lineHeight: 17 },
  retry: { color: COLORS.danger, fontWeight: '900', fontSize: 12 },
});
