import React, { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingBag, Clock, CheckCircle2, IndianRupee, Layers, Package, ArrowRight, ChefHat, Settings, Utensils, Tag } from 'lucide-react-native';
import Header from '../../components/common/Header';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import adminService from '../../services/adminService';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import COLORS from '../../constants/colors';

const currency = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

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

  const fetchOverview = useCallback(async () => {
    try {
      setError('');
      const [a, s] = await Promise.all([adminService.getAnalytics({ period }), api.get('/settings')]);
      if (!a?.success || !a.analytics || !s?.settings) throw new Error('Dashboard data is incomplete.');
      setAnalytics(a.analytics);
      setSettings(s.settings);
    } catch (e) {
      setError(e.message || 'Could not load the dashboard. Check your connection and access.');
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
    } catch (e) {
      setError(e.message || 'Could not update order acceptance.');
    } finally { setSaving(false); }
  };

  if (loading && !analytics) return <LoadingIndicator message="Loading shop dashboard…" />;
  const paymentCount = status => analytics?.paymentBreakdown?.find(row => row._id === status)?.count || 0;
  const orderCount = status => analytics?.statusBreakdown?.find(row => row._id === status)?.count || 0;
  const returning = analytics?.customerRepeatStats || { uniqueCustomers: 0, returningCustomers: 0 };
  const peakHour = analytics?.ordersByHour?.[0];
  const trendChart = (title, rows, valueKey, formatter) => {
    const maximum = Math.max(1, ...(rows || []).map(row => Number(row[valueKey] || 0)));
    return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{rows?.length ? rows.map(row => <View key={row._id} style={styles.trendRow}><Text style={styles.trendLabel}>{valueKey === 'orders' && /^\d+$/.test(String(row._id)) ? `${String(row._id).padStart(2, '0')}:00` : String(row._id).slice(5)}</Text><View style={styles.barTrack}><View style={[styles.bar, { width: `${Math.max(3, Number(row[valueKey] || 0) / maximum * 100)}%` }]} /></View><Text style={styles.trendValue}>{formatter(row[valueKey] || 0)}</Text></View>) : <Text style={styles.muted}>No data for this period.</Text>}</View>;
  };
  const metric = (label, value, detail, Icon, color) => (
    <View style={styles.metricCard} key={label}>
      <View style={styles.metricTop}><View style={[styles.iconBox, { backgroundColor: `${color}18` }]}><Icon size={18} color={color} /></View><Text style={styles.metricValue}>{value}</Text></View>
      <Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );

  return <View style={styles.container}>
    <Header title="Wrapchik Operations" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOverview(); }} colors={[COLORS.primary]} />}>
      {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={() => { setLoading(true); fetchOverview(); }}><Text style={styles.retry}>Retry</Text></TouchableOpacity></View>}
      <View style={styles.pageIntro}><View><Text style={styles.eyebrow}>ADMINISTRATION · TIET PATIALA</Text><Text style={styles.pageTitle}>Today at a glance</Text></View>
        <TouchableOpacity disabled={!settings || saving} onPress={toggleAcceptingOrders} style={[styles.acceptChip, settings?.acceptingOrders ? styles.acceptOn : styles.acceptOff]}><View style={[styles.dot, settings?.acceptingOrders ? styles.dotOn : styles.dotOff]} /><Text style={styles.acceptText}>{settings ? (settings.acceptingOrders ? 'Accepting orders' : 'Orders paused') : 'Settings unavailable'}</Text></TouchableOpacity>
      </View>
      <View style={styles.periodRow}>{[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']].map(([value, label]) => <TouchableOpacity key={value} onPress={() => setPeriod(value)} style={[styles.periodChip, period === value && styles.periodSelected]}><Text style={[styles.periodText, period === value && styles.periodTextSelected]}>{label}</Text></TouchableOpacity>)}</View>
      {analytics ? <>
        <View style={styles.revenuePanel}><View><Text style={styles.revenueCaption}>PAID REVENUE · {period === 'today' ? 'TODAY' : period === '7d' ? 'LAST 7 DAYS' : 'LAST 30 DAYS'}</Text><Text style={styles.revenueAmount}>{currency(period === 'today' ? analytics.todayRevenue : analytics.periodRevenue)}</Text><Text style={styles.revenueSub}>{analytics.periodOrders} orders in selected period · all-time paid {currency(analytics.totalRevenue)}</Text></View><IndianRupee size={23} color="#fff" /></View>
        <View style={styles.metricsGrid}>
          {metric('Orders today', analytics.todayOrders, 'All payment states', ShoppingBag, '#546B83')}
          {metric('Awaiting acceptance', orderCount('PLACED'), 'New orders', Clock, '#C17A17')}
          {metric('In preparation', orderCount('PREPARING'), 'Kitchen queue', ChefHat, '#D64B22')}
          {metric('Ready for pickup', orderCount('READY'), 'Awaiting collection', CheckCircle2, '#2F8B4E')}
          {metric('Completed', analytics.completedOrders, 'All time', CheckCircle2, '#2F8B4E')}
          {metric('Menu availability', `${analytics.availableProducts}/${analytics.totalProducts}`, `${analytics.unavailableProducts} unavailable`, Package, '#546B83')}
          {metric('Average paid order', currency(analytics.averageOrderValue), `${analytics.paidOrderCount} paid orders`, IndianRupee, '#546B83')}
          {metric('Returning customers', `${returning.returningCustomers}/${returning.uniqueCustomers}`, 'Customers with 2+ paid orders', ShoppingBag, '#546B83')}
          {metric('Peak ordering hour', peakHour ? `${String(peakHour._id).padStart(2, '0')}:00` : '—', peakHour ? `${peakHour.orders} orders · India time` : 'No orders in range', Clock, '#C17A17')}
        </View>
        {trendChart('Paid revenue trend · selected period', analytics.revenueTrend, 'amount', currency)}
        {trendChart('Order volume trend · selected period', analytics.orderVolumeTrend, 'orders', value => `${value} orders`)}
        <View style={styles.section}><Text style={styles.sectionTitle}>Payments · selected period</Text><View style={styles.paymentRow}><Text style={styles.paymentLabel}>Paid</Text><Text style={styles.paymentValue}>{paymentCount('SUCCESS')}</Text></View><View style={styles.paymentRow}><Text style={styles.paymentLabel}>Pending</Text><Text style={styles.paymentValue}>{paymentCount('PENDING')}</Text></View><View style={styles.paymentRow}><Text style={styles.paymentLabel}>Failed</Text><Text style={styles.paymentValue}>{paymentCount('FAILED')}</Text></View></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Order outcomes · selected period</Text><View style={styles.paymentRow}><Text style={styles.paymentLabel}>Cancelled</Text><Text style={styles.paymentValue}>{analytics.cancelledOrders} · {analytics.cancellationRate}%</Text></View><View style={styles.paymentRow}><Text style={styles.paymentLabel}>Rejected</Text><Text style={styles.paymentValue}>{analytics.rejectedOrders} · {analytics.rejectionRate}%</Text></View><Text style={styles.muted}>Rates use all orders created in this date range as the denominator.</Text></View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Payment methods · selected period</Text>{analytics.paymentMethodBreakdown?.length ? analytics.paymentMethodBreakdown.map(row => <View key={`${row._id.method}-${row._id.status}`} style={styles.paymentRow}><Text style={styles.paymentLabel}>{row._id.method || 'Unknown'} · {row._id.status || 'Unknown'}</Text><Text style={styles.paymentValue}>{row.count}</Text></View>) : <Text style={styles.muted}>No payment records in this period.</Text>}</View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Fulfilment · selected period</Text>{analytics.ordersByType?.length ? analytics.ordersByType.map(row => <View key={row._id || 'unknown'} style={styles.paymentRow}><Text style={styles.paymentLabel}>{row._id || 'Unknown'}</Text><Text style={styles.paymentValue}>{row.count}</Text></View>) : <Text style={styles.muted}>No orders in this period.</Text>}</View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Popular items · paid orders in selected period</Text>{analytics.popularProducts?.length ? analytics.popularProducts.map((item, index) => <View key={item._id || `${item.name}-${index}`} style={styles.paymentRow}><Text style={styles.itemRank}>{index + 1}</Text><Text style={styles.itemName}>{item.name || 'Menu item'}</Text><Text style={styles.paymentValue}>{item.totalQuantity} sold</Text></View>) : <Text style={styles.muted}>No paid item sales recorded for this period.</Text>}</View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Coupon performance · paid orders</Text>{analytics.couponPerformance?.length ? analytics.couponPerformance.map(row => <View key={row._id} style={styles.paymentRow}><Text style={styles.paymentLabel}>{row._id} · {row.orders} orders</Text><Text style={styles.paymentValue}>{currency(row.discountAmount)} off</Text></View>) : <Text style={styles.muted}>No paid coupon orders recorded for this period.</Text>}</View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Operational alerts · selected period</Text>
          {analytics.unavailableProducts > 0 ? <TouchableOpacity onPress={() => router.push('/admin/products')} style={styles.alertRow}><Text style={styles.alertMark}>!</Text><Text style={styles.alertText}>{analytics.unavailableProducts} menu item{analytics.unavailableProducts === 1 ? '' : 's'} currently unavailable</Text><ArrowRight size={15} color="#8C929A"/></TouchableOpacity> : null}
          {paymentCount('PENDING') > 0 ? <TouchableOpacity onPress={() => router.push('/admin/orders')} style={styles.alertRow}><Text style={styles.alertMarkAmber}>!</Text><Text style={styles.alertText}>{paymentCount('PENDING')} order payment{paymentCount('PENDING') === 1 ? '' : 's'} pending confirmation</Text><ArrowRight size={15} color="#8C929A"/></TouchableOpacity> : null}
          {analytics.unavailableProducts === 0 && paymentCount('PENDING') === 0 ? <Text style={styles.muted}>No availability or pending-payment alerts in this view.</Text> : null}
        </View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Recent orders</Text>{analytics.recentOrders?.length ? analytics.recentOrders.map(order => <TouchableOpacity key={order._id} onPress={() => router.push('/admin/orders')} style={styles.orderRow}><View style={{ flex: 1 }}><Text style={styles.orderTitle}>#{order.orderNumber} · {order.customerSnapshot?.name || 'Customer'}</Text><Text style={styles.orderMeta}>{order.orderType || 'TAKEAWAY'} · {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {order.paymentStatus || 'PENDING'}</Text></View><Text style={styles.orderAmount}>{currency(order.totalAmount)}</Text></TouchableOpacity>) : <Text style={styles.muted}>No orders recorded for this view yet.</Text>}</View>
      </> : null}
      <Text style={styles.sectionHeading}>Manage outlet</Text>
      {[[ChefHat, 'Kitchen & orders', 'Review, accept and progress customer orders', '/admin/orders'], [Package, 'Menu products', 'Edit prices, customisations and availability', '/admin/products'], [Layers, 'Categories', 'Organise the outlet menu', '/admin/categories'], [Tag, 'Coupons & offers', 'Set eligibility, dates and usage limits', '/admin/coupons'], [Utensils, 'Dine-in tables', 'Create tables and manage current availability', '/admin/tables'], [Settings, 'Store settings', 'Hours, fulfilment, scheduling and preparation', '/admin/settings']].map(([Icon, title, subtitle, path]) => <TouchableOpacity key={title} onPress={() => router.push(path)} style={styles.actionRow}><View style={styles.actionIcon}><Icon size={20} color={COLORS.primary} /></View><View style={{ flex: 1 }}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionSub}>{subtitle}</Text></View><ArrowRight size={18} color="#8C929A" /></TouchableOpacity>)}
      <TouchableOpacity onPress={async () => { await logout(); router.replace('/(auth)/login'); }} style={styles.logout}><Text style={styles.logoutText}>Log out</Text></TouchableOpacity>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F4F1' }, content: { padding: 20, paddingBottom: 36, maxWidth: 1120, width: '100%', alignSelf: 'center' },
  pageIntro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 4, marginBottom: 16 }, eyebrow: { color: '#8A776A', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, pageTitle: { fontSize: 25, fontWeight: '900', color: '#242A32', marginTop: 5 },
  acceptChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9 }, acceptOn: { backgroundColor: '#E6F4E9' }, acceptOff: { backgroundColor: '#FCEBE8' }, dot: { width: 8, height: 8, borderRadius: 4 }, dotOn: { backgroundColor: '#258344' }, dotOff: { backgroundColor: '#C33B2C' }, acceptText: { fontSize: 12, fontWeight: '800', color: '#343A40' },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 }, periodChip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E1DC' }, periodSelected: { backgroundColor: '#282D33', borderColor: '#282D33' }, periodText: { color: '#626971', fontSize: 12, fontWeight: '700' }, periodTextSelected: { color: '#fff' },
  revenuePanel: { backgroundColor: '#302F2D', padding: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }, revenueCaption: { color: '#F4B29D', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, revenueAmount: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4 }, revenueSub: { color: '#D1D0CE', fontSize: 12, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metricCard: { backgroundColor: '#fff', borderColor: '#E8E4DE', borderWidth: 1, borderRadius: 10, padding: 14, flexGrow: 1, flexBasis: 145, minWidth: 135 }, metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, metricValue: { color: '#252B33', fontWeight: '900', fontSize: 22 }, metricLabel: { color: '#3E444B', fontWeight: '800', fontSize: 12, marginTop: 11 }, metricDetail: { color: '#838991', fontSize: 11, marginTop: 3 },
  section: { backgroundColor: '#fff', borderColor: '#E8E4DE', borderWidth: 1, borderRadius: 10, padding: 16, marginTop: 13 }, sectionTitle: { color: '#252B33', fontSize: 15, fontWeight: '900', marginBottom: 12 }, paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0EEEB' }, paymentLabel: { color: '#666C73', fontSize: 13 }, paymentValue: { color: '#252B33', fontSize: 13, fontWeight: '800' }, trendRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 }, trendLabel: { width: 48, color: '#7D838A', fontSize: 10 }, barTrack: { flex: 1, height: 8, backgroundColor: '#F1EEEA', borderRadius: 5, overflow: 'hidden' }, bar: { height: 8, backgroundColor: COLORS.primary, borderRadius: 5 }, trendValue: { width: 70, textAlign: 'right', color: '#42484F', fontSize: 10, fontWeight: '700' }, itemRank: { width: 22, color: '#9A6654', fontSize: 12, fontWeight: '900' }, itemName: { color: '#4B5259', fontSize: 12, flex: 1 }, alertRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F0EEEB' }, alertMark: { color: '#AE3D31', backgroundColor: '#FCEBE8', fontWeight: '900', textAlign: 'center', width: 20, height: 20, borderRadius: 10, overflow: 'hidden', lineHeight: 20 }, alertMarkAmber: { color: '#8A5A0E', backgroundColor: '#FFF2D7', fontWeight: '900', textAlign: 'center', width: 20, height: 20, borderRadius: 10, overflow: 'hidden', lineHeight: 20 }, alertText: { color: '#565D64', fontSize: 12, flex: 1 }, orderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#F0EEEB', gap: 12 }, orderTitle: { color: '#343A41', fontSize: 13, fontWeight: '800' }, orderMeta: { color: '#80868D', fontSize: 11, marginTop: 4 }, orderAmount: { color: '#30353B', fontWeight: '800', fontSize: 13 }, muted: { color: '#858A90', fontSize: 12 }, sectionHeading: { color: '#252B33', fontSize: 17, fontWeight: '900', marginTop: 24, marginBottom: 10 }, actionRow: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E4DE', borderRadius: 10, padding: 13, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, actionIcon: { width: 38, height: 38, backgroundColor: '#FFF0EB', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, actionTitle: { color: '#2D333B', fontSize: 13, fontWeight: '800' }, actionSub: { color: '#7B8188', fontSize: 11, marginTop: 3 }, logout: { padding: 14, alignItems: 'center' }, logoutText: { color: '#A83930', fontSize: 13, fontWeight: '800' }, errorBox: { backgroundColor: '#FCEBE8', borderColor: '#F0C5BF', borderWidth: 1, padding: 12, borderRadius: 9, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, errorText: { color: '#9B3328', fontSize: 12, flex: 1 }, retry: { color: '#9B3328', fontWeight: '900', fontSize: 12 },
});
