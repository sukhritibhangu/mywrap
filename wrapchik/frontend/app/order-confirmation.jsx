import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Clock3, MapPin, ShoppingBag, XCircle } from 'lucide-react-native';
import Header from '../components/common/Header';
import Confetti from '../components/enchanted/Confetti';
import Wrapoo from '../components/wrapoo/Wrapoo';
import Button from '../components/common/Button';
import StatusBadge from '../components/common/StatusBadge';
import LoadingIndicator from '../components/common/LoadingIndicator';
import ErrorState from '../components/common/ErrorState';
import orderService from '../services/orderService';
import COLORS from '../constants/colors';

function progressMessage(status) {
  if (status === 'PLACED') return 'Your order request is with the outlet. We’ll show updates here.';
  if (status === 'ACCEPTED' || status === 'PREPARING') return 'The kitchen has accepted your order and is preparing it.';
  if (status === 'READY') return 'Your order is ready. Please follow the pickup details below.';
  if (status === 'REJECTED' || status === 'CANCELLED') return `This order is ${status.toLowerCase()}. Check the order details or contact campus support.`;
  return 'Your order details and latest status are below.';
}

export default function OrderConfirmationScreen() {
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(!orderId);
  const orderWasDeclined = ['REJECTED', 'CANCELLED'].includes(order?.orderStatus);

  const fetchOrder = useCallback(async () => {
    if (!orderId) { setLoading(false); setError(true); return; }
    setLoading(true);
    try {
      const response = await orderService.getOrderById(orderId);
      if (!response?.success || !response.order) throw new Error('Order details are unavailable.');
      setOrder(response.order);
      setError(false);
    } catch (e) {
      console.warn('[Order Confirmation Error]:', e);
      setError(true);
    } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  if (loading) return <LoadingIndicator message="Loading your order details…" />;

  return (
    <View style={styles.container}>
      <Header title={order ? 'Order confirmation' : orderId ? 'Order details' : 'Order status'} showBack={false} showCart={false} />
      <Confetti active={Boolean(order) && !orderWasDeclined} />
      {error || !order ? <>
        <ErrorState
          title={orderId ? 'We couldn’t load the order' : 'No order to confirm'}
          message={orderId ? 'Your order may still have been placed. Check your order history or try loading the details again.' : 'No order reference was provided. Open your order history to check an existing order.'}
          onRetry={orderId ? fetchOrder : undefined}
        />
        {!orderId ? <Button title="Open order history" onPress={() => router.replace('/(tabs)/orders')} /> : null}
      </> : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.heroRow}>
              <View style={[styles.iconCircle, orderWasDeclined && styles.declinedCircle]}>{orderWasDeclined ? <XCircle size={34} color={COLORS.danger} /> : <CheckCircle2 size={34} color={COLORS.success} />}</View>
              <Wrapoo size={72} mood={orderWasDeclined ? 'sleepy' : 'cheer'} />
            </View>
            <Text style={styles.eyebrow}>ORDER #{order.orderNumber}</Text>
            <Text style={styles.title}>{orderWasDeclined ? 'An update on your order' : 'Wohoo! Order placed'}</Text>
            <Text style={styles.subtitle}>{progressMessage(order.orderStatus)}</Text>
            <View style={styles.statusRow}><Text style={styles.label}>Order status</Text><StatusBadge status={order.orderStatus} /></View>
            <View style={styles.statusRow}><Text style={styles.label}>Payment status</Text><StatusBadge status={order.paymentStatus} /></View>
            <View style={styles.divider} />
            <View style={styles.sectionHeader}><ShoppingBag size={17} color={COLORS.primary} /><Text style={styles.sectionTitle}>Your items</Text></View>
            {(order.items || []).map((item, index) => <View key={`${item.productId || item.name}-${index}`} style={styles.itemRow}><Text style={styles.itemQuantity}>{item.quantity}×</Text><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text>{item.customizations?.length ? <Text style={styles.itemCustom}>{item.customizations.map((entry) => entry.name).join(' · ')}</Text> : null}</View><Text style={styles.itemPrice}>₹{item.itemTotal ?? (item.priceAtPurchase * item.quantity)}</Text></View>)}
            <View style={styles.divider} />
            {order.subtotal != null ? <View style={styles.detailRow}><Text style={styles.label}>Subtotal</Text><Text style={styles.detailValue}>₹{order.subtotal}</Text></View> : null}
            {Number(order.discountAmount) > 0 ? <View style={styles.detailRow}><Text style={styles.label}>Coupon{order.couponCode ? ` · ${order.couponCode}` : ''}</Text><Text style={styles.discountValue}>−₹{order.discountAmount}</Text></View> : null}
            {order.taxAndFees != null ? <View style={styles.detailRow}><Text style={styles.label}>Taxes & fees</Text><Text style={styles.detailValue}>₹{order.taxAndFees}</Text></View> : null}
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Order total</Text><Text style={styles.totalValue}>₹{order.totalAmount}</Text></View>
            <View style={styles.detailRow}><Text style={styles.label}>Payment</Text><Text style={styles.detailValue}>{order.paymentMethod === 'CASHFREE' ? 'Legacy Cashfree' : order.paymentMethod === 'RAZORPAY' ? 'Legacy Razorpay' : order.paymentMethod === 'UPI_QR' ? 'UPI QR' : 'Cash at counter'}</Text></View>
            {order.orderType === 'TAKEAWAY' ? <View style={styles.location}><MapPin size={16} color={COLORS.primary} /><View style={styles.itemCopy}><Text style={styles.locationTitle}>Pickup</Text><Text style={styles.locationText}>{order.pickupLocation || 'Wrapchik SAC Counter'}</Text>{order.pickupTimeSlot ? <Text style={styles.locationText}>Time: {order.pickupTimeSlot}</Text> : null}</View></View> : null}
            {order.orderType === 'DELIVERY' ? <View style={styles.location}><MapPin size={16} color={COLORS.primary} /><View style={styles.itemCopy}><Text style={styles.locationTitle}>Delivery</Text><Text style={styles.locationText}>{[order.hostel, order.roomNumber].filter(Boolean).join(' · ')}</Text></View></View> : null}
            {order.orderType === 'DINE_IN' && order.tableId ? <View style={styles.location}><MapPin size={16} color={COLORS.primary} /><Text style={styles.locationText}>Dine-in at your selected table</Text></View> : null}
            {order.estimatedPrepTime ? <View style={styles.prep}><Clock3 size={15} color={COLORS.textSecondary} /><Text style={styles.prepText}>Estimated preparation: {order.estimatedPrepTime} min</Text></View> : null}
            <Button title="Track this order" onPress={() => router.replace(`/order-tracking/${order._id}`)} style={styles.primaryAction} />
            <Button title="Back to menu" variant="outline" onPress={() => router.replace('/(tabs)/home')} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 18, paddingBottom: 32, maxWidth: 660, width: '100%', alignSelf: 'center' },
  card: { padding: 22, borderRadius: 28, backgroundColor: COLORS.cardBackground, borderWidth: 1, borderColor: COLORS.border },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  iconCircle: { width: 62, height: 62, borderRadius: 22, backgroundColor: COLORS.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  declinedCircle: { backgroundColor: COLORS.dangerLight },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.textPrimary, fontSize: 27, lineHeight: 33, fontWeight: '900', marginTop: 5, letterSpacing: -0.3 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 42 },
  label: { color: COLORS.textSecondary, fontSize: 13 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  itemQuantity: { color: COLORS.primary, fontSize: 13, fontWeight: '900', width: 28 },
  itemCopy: { flex: 1 }, itemName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  itemCustom: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  itemPrice: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' }, totalValue: { color: COLORS.primary, fontSize: 19, fontWeight: '900' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, detailValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' }, discountValue: { color: COLORS.success, fontSize: 13, fontWeight: '800' },
  location: { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 15, backgroundColor: COLORS.primaryLight, marginBottom: 12 },
  locationTitle: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 2 }, locationText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  prep: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 }, prepText: { color: COLORS.textSecondary, fontSize: 12 },
  primaryAction: { marginBottom: 10 },
});
