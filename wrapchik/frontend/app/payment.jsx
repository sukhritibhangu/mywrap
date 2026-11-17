import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Linking, Platform, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { ShieldCheck, Lock, BadgeCheck } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import paymentService from '../services/paymentService';
import orderService from '../services/orderService';
import { clearCheckoutIntentKey } from '../services/checkoutIntent';
import COLORS from '../constants/colors';
import THEME from '../constants/theme';

export default function PaymentScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { clearCart } = useContext(CartContext);
  const rawOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const orderId = typeof rawOrderId === 'string' ? rawOrderId : '';
  const [order, setOrder] = useState(null);
  const [instructions, setInstructions] = useState(null);
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [upiAppUnavailable, setUpiAppUnavailable] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);
  const autoLaunchAttemptedUri = useRef('');

  useEffect(() => { setQrImageError(false); }, [instructions?.qrImageUrl]);

  const refresh = useCallback(async (showFeedback = false) => {
    if (!orderId) { setLoading(false); return; }
    try {
      const result = await orderService.getOrderById(orderId);
      if (!result?.success || !result.order) throw new Error('Order details are unavailable.');
      setOrder(result.order);
      if (result.order.paymentMethod === 'UPI_QR' && result.order.paymentStatus !== 'SUCCESS') {
        const response = await paymentService.getUpiInstructions(orderId);
        setInstructions(response?.instructions || null);
      }
      if (result.order.paymentStatus === 'SUCCESS') {
        router.replace({ pathname: '/order-confirmation', params: { orderId, orderNumber: result.order.orderNumber, method: 'UPI (verified by outlet)' } });
      }
      if (showFeedback) { setMessage('Payment status refreshed.'); setIsError(false); }
    } catch (error) {
      if (showFeedback) { setMessage(error.message || 'Could not refresh payment status.'); setIsError(true); }
    } finally { setLoading(false); }
  }, [orderId, router]);

  useEffect(() => { clearCart(); clearCheckoutIntentKey(); refresh(); }, [clearCart, refresh]);

  const openUpiApp = useCallback(async () => {
    if (!instructions?.upiUri) return;
    setUpiAppUnavailable(false);
    try {
      await Linking.openURL(instructions.upiUri);
    } catch {
      setUpiAppUnavailable(true);
      setMessage(Platform.OS === 'web'
        ? 'A UPI app could not be opened here. Scan the QR code with a UPI app on your phone.'
        : 'No compatible UPI app opened. Scan the QR code with Google Pay, PhonePe, Paytm, BHIM, or another UPI app.');
      setIsError(false);
    }
  }, [instructions?.upiUri]);

  useEffect(() => {
    const uri = instructions?.upiUri;
    if (Platform.OS !== 'android' || !uri || order?.paymentStatus === 'SUCCESS' || autoLaunchAttemptedUri.current === uri) return;
    autoLaunchAttemptedUri.current = uri;
    openUpiApp();
  }, [instructions?.upiUri, order?.paymentStatus, openUpiApp]);

  const submitReference = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await paymentService.submitUpiReference(orderId, reference);
      setMessage(response?.message || 'Reference submitted. Payment remains pending until the outlet verifies receipt.');
      setIsError(false); setReference(''); await refresh();
    } catch (error) { setMessage(error.message || 'Could not submit this reference.'); setIsError(true); }
    finally { setBusy(false); }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="UPI payment" showBack showCart={false} />
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Header title="Payment details" showBack showCart={false} />
        <View style={styles.content}>
          <Text style={styles.title}>Order details are unavailable</Text>
          <Text style={styles.muted}>Check your order history for the latest status.</Text>
          <Button title="View orders" onPress={() => router.replace('/(tabs)/orders')} style={styles.buttonGap} />
        </View>
      </View>
    );
  }

  if (order.paymentMethod !== 'UPI_QR') {
    const legacy = ['CASHFREE', 'RAZORPAY'].includes(order.paymentMethod);
    return (
      <View style={styles.container}>
        <Header title="Payment status" showBack showCart={false} />
        <View style={styles.content}>
          <View style={styles.cashCard}>
            <ShieldCheck size={30} color={COLORS.gold} />
            <Text style={styles.title}>{legacy ? 'Historical gateway order' : 'Cash at counter'}</Text>
            <Text style={styles.muted}>
              {legacy
                ? 'This order uses a legacy payment method. Its saved payment status remains available in order details.'
                : 'Pay at the Wrapchik counter when you collect your order.'}
            </Text>
            <Text style={styles.status}>Order #{order.orderNumber} · {order.paymentStatus}</Text>
          </View>
          <Button title="View order status" onPress={() => router.replace(`/order-tracking/${orderId}`)} style={styles.buttonGap} />
        </View>
      </View>
    );
  }

  const submittedReference = order.paymentId?.upiTransactionReference;
  const rejectedReason = order.paymentId?.verificationReason;
  const canSubmit = order.paymentStatus !== 'SUCCESS' && order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'REJECTED' && (!submittedReference || order.paymentStatus === 'FAILED');
  const finalAmount = Number(instructions?.amount ?? order.totalAmount);

  return (
    <View style={styles.container}>
      <Header title="UPI payment" showBack showCart={false} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.amountCard}>
          <View style={styles.amountTop}>
            <Lock size={13} color={COLORS.goldLight} />
            <Text style={styles.amountLabel}>FINAL AMOUNT FROM THE OUTLET</Text>
          </View>
          <Text style={styles.amount}>₹{finalAmount.toFixed(2)}</Text>
          <Text style={styles.orderText}>Order #{order.orderNumber}</Text>
          <View style={styles.amountBadge}>
            <BadgeCheck size={13} color={COLORS.cocoa} />
            <Text style={styles.amountBadgeText}>Check this amount and the payee before paying</Text>
          </View>
        </View>

        {instructions?.qrImageUrl ? (
          <View style={styles.qrCard}>
            <Text style={styles.qrLabel}>OUTLET UPI QR</Text>
            {qrImageError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                The outlet QR could not load. Do not pay using another QR; contact the outlet.
              </Text>
            ) : (
              <Image
                source={{ uri: instructions.qrImageUrl }}
                style={styles.qrImage}
                resizeMode="contain"
                accessibilityLabel="UPI QR provided by the outlet administrator"
                onError={() => setQrImageError(true)}
              />
            )}
            <Text style={styles.qrHint}>
              Scan this QR using a UPI app. Pay exactly ₹{finalAmount.toFixed(2)} and verify the recipient name in your app before paying.
            </Text>
          </View>
        ) : instructions?.upiUri ? (
          <View style={styles.qrCard}>
            <Text style={styles.qrLabel}>OUTLET UPI QR</Text>
            <QRCode value={instructions.upiUri} size={220} backgroundColor="#FFFFFF" color={COLORS.cocoa} />
            <Text style={styles.qrHint}>Scan with Google Pay, PhonePe, Paytm, BHIM, or another UPI app.</Text>
          </View>
        ) : (
          <Text style={styles.error}>UPI payment is not currently available. Contact the outlet or choose another method for a new order.</Text>
        )}

        {upiAppUnavailable ? (
          <Text style={styles.fallbackHint}>No compatible UPI app was found. Use the QR code above with a UPI app on another device.</Text>
        ) : null}

        {instructions ? (
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PAYEE</Text>
              <Text style={styles.detailValue}>{instructions.payeeName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>UPI ID</Text>
              <Text style={styles.detailValue} selectable>{instructions.upiId}</Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={styles.detailLabel}>ORDER REFERENCE</Text>
              <Text style={styles.detailValue}>{instructions.orderNumber}</Text>
            </View>
          </View>
        ) : null}

        {instructions?.upiUri ? <Button title="Pay using UPI App" onPress={openUpiApp} /> : null}

        <View style={styles.verifyNote}>
          <ShieldCheck size={15} color={COLORS.cocoaSoft} />
          <Text style={styles.instruction}>
            After paying, submit your UPI transaction reference. The outlet checks its receipt records and confirms the payment manually.
            Opening an app or submitting a reference never marks an order as paid.
          </Text>
        </View>

        {submittedReference && order.paymentStatus === 'PENDING' ? (
          <View style={styles.pendingBox}>
            <Text style={styles.pendingText}>Reference {submittedReference} is awaiting outlet verification.</Text>
          </View>
        ) : null}

        {rejectedReason ? (
          <View style={styles.rejectedBox}>
            <Text style={styles.rejectedTitle}>Payment claim rejected</Text>
            <Text style={styles.instruction}>{rejectedReason}</Text>
          </View>
        ) : null}

        {canSubmit ? (
          <>
            <Text style={styles.inputLabel}>UPI TRANSACTION REFERENCE</Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="Enter reference from your UPI app"
              placeholderTextColor={COLORS.cocoaMuted}
              autoCapitalize="characters"
              style={styles.input}
              editable={!busy}
              accessibilityLabel="UPI transaction reference"
            />
            <Button
              title={busy ? 'Submitting…' : 'I have completed the payment'}
              onPress={submitReference}
              loading={busy}
              disabled={busy || reference.trim().length < 8}
              style={styles.buttonGap}
            />
          </>
        ) : null}

        {message ? (
          <Text accessibilityRole={isError ? 'alert' : 'status'} style={[styles.message, isError && styles.error]}>{message}</Text>
        ) : null}

        <View style={styles.statusRow}>
          <Text style={styles.status}>Payment status: {order.paymentStatus}</Text>
          <Button title="Refresh status" variant="outline" onPress={() => refresh(true)} />
        </View>
        <Button title="View order status" variant="outline" onPress={() => router.replace(`/order-tracking/${orderId}`)} style={styles.buttonGap} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 36, maxWidth: 620, width: '100%', alignSelf: 'center' },
  amountCard: {
    backgroundColor: COLORS.cocoa, borderRadius: THEME.radius.xl, padding: 22, alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(217,164,65,0.5)', ...THEME.shadow.lifted,
  },
  amountTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountLabel: { color: '#F3D9A8', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1 },
  amount: { color: '#FFF9EE', fontSize: 40, fontWeight: '900', marginTop: 5, letterSpacing: -0.5 },
  orderText: { color: '#E4CDB7', fontSize: 12.5, marginTop: 3, fontWeight: '600' },
  amountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12,
    backgroundColor: COLORS.goldLight, paddingHorizontal: 11, paddingVertical: 6, borderRadius: THEME.radius.pill,
  },
  amountBadgeText: { color: COLORS.cocoa, fontSize: 10.5, fontWeight: '800' },
  qrCard: {
    backgroundColor: COLORS.cardBackground, borderRadius: THEME.radius.lg, padding: 18,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 14, ...THEME.shadow.soft,
  },
  qrLabel: { color: COLORS.goldDeep, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 12 },
  qrImage: { width: '100%', maxWidth: 300, height: 280, borderRadius: THEME.radius.sm },
  qrHint: { color: COLORS.textSecondary, fontSize: 11.5, textAlign: 'center', lineHeight: 17, marginTop: 14, maxWidth: 340 },
  detailsCard: {
    backgroundColor: COLORS.cardBackground, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: THEME.radius.lg, paddingHorizontal: 15, marginBottom: 14,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { color: COLORS.cocoaMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.9, paddingTop: 3 },
  detailValue: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  verifyNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, marginBottom: 8 },
  instruction: { color: COLORS.textSecondary, fontSize: 11.5, lineHeight: 17, flex: 1 },
  inputLabel: { color: COLORS.cocoaMuted, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9, marginTop: 8 },
  input: {
    backgroundColor: COLORS.cardBackground, borderColor: COLORS.border, borderWidth: 1.5,
    borderRadius: THEME.radius.md, paddingHorizontal: 13, minHeight: 48, color: COLORS.textPrimary, marginTop: 7, fontSize: 14,
  },
  message: { backgroundColor: COLORS.warningLight, color: COLORS.textPrimary, padding: 12, borderRadius: THEME.radius.sm, marginTop: 12, fontSize: 12, lineHeight: 17 },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, padding: 12, borderRadius: THEME.radius.sm, marginTop: 12, fontSize: 12, lineHeight: 18 },
  pendingBox: { backgroundColor: COLORS.warningLight, borderRadius: THEME.radius.md, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(178,106,18,0.2)' },
  pendingText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  rejectedBox: { backgroundColor: COLORS.dangerLight, borderRadius: THEME.radius.md, padding: 12, marginTop: 12 },
  rejectedTitle: { color: COLORS.danger, fontWeight: '900', marginBottom: 4 },
  status: { color: COLORS.cocoaMuted, fontSize: 11.5, fontWeight: '800' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 12, flexWrap: 'wrap' },
  title: { color: COLORS.textPrimary, fontSize: 21, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  muted: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  cashCard: {
    backgroundColor: COLORS.cardBackground, borderRadius: THEME.radius.xl, padding: 22,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginTop: 24, ...THEME.shadow.soft,
  },
  fallbackHint: { color: COLORS.warning, fontSize: 11.5, marginTop: 10, lineHeight: 17 },
  buttonGap: { marginTop: 12 },
});
