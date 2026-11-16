import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Linking, Platform, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import paymentService from '../services/paymentService';
import orderService from '../services/orderService';
import { clearCheckoutIntentKey } from '../services/checkoutIntent';
import COLORS from '../constants/colors';

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

  if (loading) return <View style={styles.container}><Header title="UPI payment" showBack showCart={false} /><ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} /></View>;
  if (!order) return <View style={styles.container}><Header title="Payment details" showBack showCart={false} /><View style={styles.content}><Text style={styles.title}>Order details are unavailable</Text><Text style={styles.muted}>Check your order history for the latest status.</Text><Button title="View orders" onPress={() => router.replace('/(tabs)/orders')} style={styles.buttonGap} /></View></View>;

  if (order.paymentMethod !== 'UPI_QR') {
    const legacy = ['CASHFREE', 'RAZORPAY'].includes(order.paymentMethod);
    return <View style={styles.container}><Header title="Payment status" showBack showCart={false} /><View style={styles.content}>
      <Text style={styles.title}>{legacy ? 'Historical gateway order' : 'Cash at counter'}</Text>
      <Text style={styles.muted}>{legacy ? 'This order uses a legacy payment method. Its saved payment status remains available in order details.' : 'Pay at the Wrapchik counter when you collect your order.'}</Text>
      <Text style={styles.status}>Order #{order.orderNumber} · {order.paymentStatus}</Text>
      <Button title="View order status" onPress={() => router.replace(`/order-tracking/${orderId}`)} style={styles.buttonGap} />
    </View></View>;
  }

  const submittedReference = order.paymentId?.upiTransactionReference;
  const rejectedReason = order.paymentId?.verificationReason;
  const canSubmit = order.paymentStatus !== 'SUCCESS' && order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'REJECTED' && (!submittedReference || order.paymentStatus === 'FAILED');
  return <View style={styles.container}>
    <Header title="UPI payment" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>PAY EXACTLY</Text>
        <Text style={styles.amount}>₹{Number(instructions?.amount ?? order.totalAmount).toFixed(2)}</Text>
        <Text style={styles.orderText}>Order #{order.orderNumber}</Text>
      </View>
      {instructions?.qrImageUrl ? <View style={styles.qrCard}>
        <Text style={styles.detailValue}>Outlet UPI QR</Text>
        {qrImageError ? <Text accessibilityRole="alert" style={styles.error}>The outlet QR could not load. Do not pay using another QR; contact the outlet.</Text> : <Image source={{ uri: instructions.qrImageUrl }} style={{ width: '100%', maxWidth: 300, height: 300, marginTop: 12 }} resizeMode="contain" accessibilityLabel="UPI QR provided by the outlet administrator" onError={() => setQrImageError(true)} />}
        <Text style={styles.qrHint}>Scan this QR using a UPI app. Enter exactly ₹{Number(instructions.amount).toFixed(2)} and verify the recipient name in your UPI app before paying.</Text>
      </View> : instructions?.upiUri ? <View style={styles.qrCard}><QRCode value={instructions.upiUri} size={220} backgroundColor="#FFFFFF" color="#1E2633" /><Text style={styles.qrHint}>Scan with Google Pay, PhonePe, Paytm, BHIM, or another UPI app.</Text></View> : <Text style={styles.error}>UPI payment is not currently available. Contact the outlet or choose another method for a new order.</Text>}
      {upiAppUnavailable ? <Text style={styles.fallbackHint}>No compatible UPI app was found. Use the QR code above with a UPI app on another device.</Text> : null}
      {instructions ? <View style={styles.detailsCard}>
        <Text style={styles.detailLabel}>PAYEE</Text><Text style={styles.detailValue}>{instructions.payeeName}</Text>
        <Text style={styles.detailLabel}>UPI ID</Text><Text style={styles.detailValue}>{instructions.upiId}</Text>
        <Text style={styles.detailLabel}>ORDER REFERENCE</Text><Text style={styles.detailValue}>{instructions.orderNumber}</Text>
      </View> : null}
      {instructions?.upiUri ? <Button title="Pay using UPI App" onPress={openUpiApp} /> : null}
      <Text style={styles.instruction}>After paying, return here and submit the UPI transaction reference. The outlet will check its receipt records and confirm the payment manually. Opening an app or submitting a reference never marks an order as paid.</Text>
      {submittedReference && order.paymentStatus === 'PENDING' ? <View style={styles.pendingBox}><Text style={styles.pendingText}>Reference {submittedReference} is awaiting outlet verification.</Text></View> : null}
      {rejectedReason ? <View style={styles.rejectedBox}><Text style={styles.rejectedTitle}>Payment claim rejected</Text><Text style={styles.instruction}>{rejectedReason}</Text></View> : null}
      {canSubmit ? <>
        <Text style={styles.detailLabel}>UPI TRANSACTION REFERENCE</Text>
        <TextInput value={reference} onChangeText={setReference} placeholder="Enter reference from your UPI app" autoCapitalize="characters" style={styles.input} editable={!busy} />
        <Button title={busy ? 'Submitting…' : 'I have completed the payment'} onPress={submitReference} loading={busy} disabled={busy || reference.trim().length < 8} style={styles.buttonGap} />
      </> : null}
      {message ? <Text accessibilityRole={isError ? 'alert' : 'status'} style={[styles.message, isError && styles.error]}>{message}</Text> : null}
      <View style={styles.statusRow}><Text style={styles.status}>Payment status: {order.paymentStatus}</Text><Button title="Refresh status" variant="outline" onPress={() => refresh(true)} /></View>
      <Button title="View order status" variant="outline" onPress={() => router.replace(`/order-tracking/${orderId}`)} style={styles.buttonGap} />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32, maxWidth: 620, width: '100%', alignSelf: 'center' },
  amountCard: { backgroundColor: COLORS.primary, borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 16 },
  amountLabel: { color: '#FFE5D8', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  amount: { color: '#FFF', fontSize: 38, fontWeight: '900', marginTop: 4 },
  orderText: { color: '#FFF', fontSize: 13, marginTop: 4 },
  qrCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  qrHint: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 14 },
  detailsCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 15, marginBottom: 14 },
  detailLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 8 },
  detailValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 2 },
  instruction: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 12 },
  input: { backgroundColor: '#FFF', borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: COLORS.textPrimary, marginTop: 7 },
  message: { backgroundColor: COLORS.warningLight, color: COLORS.textPrimary, padding: 12, borderRadius: 10, marginTop: 12, fontSize: 12 },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, padding: 12, borderRadius: 10, marginTop: 12, fontSize: 12, lineHeight: 18 },
  pendingBox: { backgroundColor: COLORS.warningLight, borderRadius: 12, padding: 12, marginTop: 12 },
  pendingText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  rejectedBox: { backgroundColor: COLORS.dangerLight, borderRadius: 12, padding: 12, marginTop: 12 },
  rejectedTitle: { color: COLORS.danger, fontWeight: '900' },
  status: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', marginVertical: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12 },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginTop: 20 },
  muted: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  buttonGap: { marginTop: 12 },
});
