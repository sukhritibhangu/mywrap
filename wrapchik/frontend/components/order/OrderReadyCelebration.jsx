import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PackageCheck, X } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import orderService from '../../services/orderService';
import Confetti from '../enchanted/Confetti';
import Wrapoo from '../wrapoo/Wrapoo';
import Button from '../common/Button';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const SEEN_PREFIX = 'wrapchik_ready_celebrated:';
const SETTLED_STATUSES = ['READY', 'PICKED_UP', 'DELIVERED', 'SERVED', 'COMPLETED'];

const messageFor = (order) => {
  if (order?.orderType === 'DELIVERY') {
    return 'Yay! Your order is ready! 🎉 Your food is ready for the delivery process!';
  }
  return 'Yay! Your order is ready! 🎉 Head over and pick up your delicious food!';
};

/**
 * Watches the realtime order feed and celebrates exactly once when an order
 * genuinely transitions to READY. Statuses already seen are remembered per
 * account so a refresh or re-poll never replays the same party.
 */
export default function OrderReadyCelebration() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [celebration, setCelebration] = useState(null);
  const seenRef = useRef(new Set());
  const readyRef = useRef(false);
  const userId = user?._id;

  const persist = useCallback(async () => {
    if (!userId) return;
    try {
      await AsyncStorage.setItem(`${SEEN_PREFIX}${userId}`, JSON.stringify([...seenRef.current].slice(-120)));
    } catch (error) {
      // Losing the cache only risks a repeat celebration; never crash for it.
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    setCelebration(null);
    seenRef.current = new Set();
    readyRef.current = false;
    if (!userId) return () => { active = false; };

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(`${SEEN_PREFIX}${userId}`);
        const parsed = stored ? JSON.parse(stored) : [];
        if (!active) return;
        seenRef.current = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
      } catch (error) {
        if (!active) return;
        seenRef.current = new Set();
      }

      try {
        const response = await orderService.getMyOrders();
        if (!active || !response?.success || !Array.isArray(response.orders)) return;
        // Anything already READY or beyond when the app opens is not a new event.
        response.orders
          .filter((order) => SETTLED_STATUSES.includes(order.orderStatus))
          .forEach((order) => seenRef.current.add(String(order._id)));
        persist();
      } catch (error) {
        // Offline: the realtime handler still celebrates when it reconnects.
      } finally {
        if (active) readyRef.current = true;
      }
    })();

    return () => { active = false; };
  }, [persist, userId]);

  const handleEvent = useCallback(async (event) => {
    if (!userId || !event?.orderId) return;
    if (event.orderStatus !== 'READY') return;
    const orderId = String(event.orderId);
    if (seenRef.current.has(orderId)) return;
    seenRef.current.add(orderId);
    persist();

    let order = null;
    try {
      const response = await orderService.getOrderById(orderId);
      order = response?.order || null;
    } catch (error) {
      order = null;
    }

    setCelebration({
      orderId,
      orderNumber: order?.orderNumber || event.orderNumber || '',
      orderType: order?.orderType || event.orderType || 'TAKEAWAY',
      total: order?.totalAmount,
    });
  }, [persist, userId]);

  useEffect(() => {
    if (!socket || !userId) return undefined;
    socket.on('order_updated', handleEvent);
    return () => socket.off('order_updated', handleEvent);
  }, [handleEvent, socket, userId]);

  const close = () => setCelebration(null);
  const openOrder = () => {
    const id = celebration.orderId;
    setCelebration(null);
    if (id) router.push(`/order-tracking/${id}`);
  };

  // Nothing to celebrate: render no modal at all, so no child ever reads a
  // half-built celebration object.
  if (!celebration) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Confetti active pieces={30} />
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss celebration" accessibilityRole="button" />

        <View style={styles.card} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <TouchableOpacity onPress={close} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close celebration">
            <X size={18} color={COLORS.cocoaSoft} />
          </TouchableOpacity>

          <Wrapoo size={96} mood="celebrating" />

          <View style={styles.pill}>
            <PackageCheck size={13} color={COLORS.success} />
            <Text style={styles.pillText}>ORDER READY</Text>
          </View>

          <Text style={styles.title}>{celebration.orderNumber ? `Order #${celebration.orderNumber} is ready!` : 'Your order is ready!'}</Text>
          <Text style={styles.message}>{messageFor(celebration)}</Text>
          {celebration.total != null ? <Text style={styles.total}>Order total ₹{celebration.total}</Text> : null}

          <Button title="View order" onPress={openOrder} style={styles.action} />
          <TouchableOpacity onPress={close} style={styles.dismiss} accessibilityRole="button">
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(58,35,24,0.58)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  card: {
    width: '100%', maxWidth: 380, alignItems: 'center',
    backgroundColor: COLORS.parchment, borderRadius: 26, paddingVertical: 22, paddingHorizontal: 20,
    borderWidth: 2, borderColor: COLORS.gold, ...THEME.shadow.lifted,
  },
  closeBtn: { position: 'absolute', top: 10, right: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
    backgroundColor: COLORS.successLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  pillText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: COLORS.success },
  title: { fontSize: 21, fontWeight: '900', color: COLORS.textPrimary, textAlign: 'center', marginTop: 10 },
  message: { fontSize: 13.5, lineHeight: 20, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },
  total: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark, marginTop: 8 },
  action: { alignSelf: 'stretch', marginTop: 16 },
  dismiss: { padding: 12, marginTop: 2 },
  dismissText: { fontSize: 12, fontWeight: '800', color: COLORS.cocoaSoft },
});
