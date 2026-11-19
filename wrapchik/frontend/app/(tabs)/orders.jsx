import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Clock, PackageCheck, History, Radio } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import { useCompanion } from '../../context/CompanionContext';
import Header from '../../components/common/Header';
import OrderCard from '../../components/order/OrderCard';
import OrderStatusTimeline from '../../components/order/OrderStatusTimeline';
import Wrapoo from '../../components/wrapoo/Wrapoo';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import orderService from '../../services/orderService';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const ACTIVE_STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP'];
const PAST_STATUSES = ['COMPLETED', 'DELIVERED', 'SERVED', 'REJECTED', 'CANCELLED'];

const VIEWS = [
  { id: 'ALL', label: 'All Orders', hint: 'Everything you have ordered', Icon: Clock, reaction: 'Here is everything you have ordered. A little trip down delicious memory lane!' },
  { id: 'ACTIVE', label: 'Live Orders', hint: 'Still in the kitchen', Icon: Radio, reaction: 'These are still in motion. I will keep an eye on them for you!' },
  { id: 'COMPLETED', label: 'Past Orders', hint: 'Delivered or cancelled', Icon: History, reaction: 'Your past bites, all in one place. Reorder anything you loved!' },
  { id: 'CURRENT', label: 'Current Order', hint: 'Live progress', Icon: PackageCheck, reaction: 'Here is your live order. I will cheer at every step!' },
];

const isActive = (order) => ACTIVE_STATUSES.includes(order?.orderStatus);
const isPast = (order) => PAST_STATUSES.includes(order?.orderStatus);

export default function OrdersScreen() {
  const router = useRouter();
  const { addToCart } = useContext(CartContext);
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const { say } = useCompanion();
  const reducedMotion = useReducedMotion();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState('ALL');
  const [loadError, setLoadError] = useState(false);
  const [reordering, setReordering] = useState(null);
  const listFade = useRef(new Animated.Value(1)).current;
  const lastSocketEventRef = useRef('');

  const fetchOrders = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      const res = await orderService.getMyOrders();
      if (!res?.success || !Array.isArray(res.orders)) throw new Error('Order history could not be loaded.');
      setOrders(res.orders);
      setLoadError(false);
    } catch (e) {
      console.warn('[OrdersScreen Error]:', e);
      setLoadError(true);
    } finally {
      if (!quiet) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!authLoading && user) {
      setOrders([]);
      fetchOrders();
    }
  }, [authLoading, user?._id, fetchOrders]));

  useEffect(() => {
    if (!socket || !user) return undefined;
    const refresh = (event) => {
      if (event?.orderId && event.orderStatus && event.paymentStatus) {
        const eventKey = `${event.orderId}:${event.orderStatus}:${event.paymentStatus}`;
        if (lastSocketEventRef.current === eventKey) return;
        lastSocketEventRef.current = eventKey;
      }
      fetchOrders({ quiet: true });
    };
    socket.on('order_updated', refresh);
    socket.on('connect', refresh);
    return () => { socket.off('order_updated', refresh); socket.off('connect', refresh); };
  }, [socket, user?._id, fetchOrders]);

  // Soft cross-fade whenever Rapo switches the view.
  useEffect(() => {
    if (reducedMotion) { listFade.setValue(1); return undefined; }
    listFade.setValue(0.25);
    const animation = Animated.timing(listFade, {
      toValue: 1, duration: 240, easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [listFade, reducedMotion, view]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleReorder = async (orderId) => {
    if (reordering) return;
    setReordering(orderId);
    try {
      const res = await orderService.reorderFromPast(orderId);
      if (res.success) {
        const { reorderItems = [], unavailableItems = [] } = res;
        reorderItems.forEach(item => {
          addToCart({
            _id: item.productId,
            name: item.name,
            price: item.basePrice,
            imageUrl: item.imageUrl,
            isVeg: item.isVeg,
          }, item.customizations, item.quantity);
        });
        if (unavailableItems && unavailableItems.length > 0) {
          Alert.alert('Notice', 'Some items from your past order are currently unavailable and were not added to your cart.');
        } else {
          Alert.alert('Success', 'Items added to cart!');
        }
        router.push('/(tabs)/cart');
      } else {
        Alert.alert('Error', 'Failed to reorder.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An error occurred while reordering.');
    } finally {
      setReordering(null);
    }
  };

  const activeOrders = useMemo(() => orders.filter(isActive), [orders]);
  const currentOrder = useMemo(
    () => [...activeOrders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null,
    [activeOrders],
  );

  const filteredOrders = useMemo(() => {
    if (view === 'ACTIVE') return orders.filter(isActive);
    if (view === 'COMPLETED') return orders.filter(isPast);
    if (view === 'CURRENT') return currentOrder ? [currentOrder] : [];
    return orders;
  }, [currentOrder, orders, view]);

  const chooseView = (next) => {
    setView(next);
    const meta = VIEWS.find((item) => item.id === next);
    if (next === 'CURRENT' && !currentOrder) say('No live order right now. Shall we fix that with something delicious?', { mood: 'thinking' });
    else if (meta) say(meta.reaction, { mood: next === 'ACTIVE' ? 'tracking' : 'happy' });
  };

  const currentEmpty = view === 'CURRENT' && !currentOrder;

  return (
    <View style={styles.container}>
      <Header title="My Orders" showCart={false} />

      {user && !authLoading ? (
        <View style={styles.rapoPanel}>
          <View style={styles.rapoRow}>
            <Wrapoo size={72} mood={currentEmpty ? 'thinking' : 'happy'} />
            <View style={styles.rapoBubble}>
              <Text style={styles.rapoKicker}>RAPO ASKS</Text>
              <Text style={styles.rapoText}>
                {currentEmpty ? 'No live order right now. Want to see what you ordered before?' : 'Hey foodie! What would you like to check today?'}
              </Text>
            </View>
          </View>
          <View style={styles.choiceGrid}>
            {VIEWS.map((option) => {
              const Icon = option.Icon;
              const selected = view === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => chooseView(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.choice, selected && styles.choiceActive]}
                >
                  <Icon size={16} color={selected ? '#FFFFFF' : COLORS.primaryDark} />
                  <View style={styles.choiceCopy}>
                    <Text style={[styles.choiceLabel, selected && styles.choiceLabelActive]}>{option.label}</Text>
                    <Text style={[styles.choiceHint, selected && styles.choiceHintActive]}>
                      {option.id === 'CURRENT' && currentOrder ? `#${currentOrder.orderNumber || ''} live` : option.hint}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {authLoading ? (
        <LoadingIndicator message="Restoring your session…" />
      ) : !user ? (
        <EmptyState title="Sign in to view your orders" message="Your order status and receipts are saved to your Wrapchik account." buttonTitle="Sign in" onButtonPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: 'orders' } })} />
      ) : loadError && !loading && orders.length === 0 ? (
        <ErrorState title="Could not load your orders" message="Check your connection and retry. Your order history has not been cleared." onRetry={handleRefresh} retrying={refreshing} />
      ) : loading && !refreshing ? (
        <LoadingIndicator message="Loading your order history..." />
      ) : view === 'CURRENT' && currentOrder ? (
        <Animated.ScrollView
          style={{ opacity: listFade }}
          contentContainerStyle={styles.currentContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
        >
          <View style={styles.currentCard}>
            <View style={styles.currentHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.currentKicker}>LIVE ORDER</Text>
                <Text style={styles.currentNumber}>#{currentOrder.orderNumber}</Text>
                <Text style={styles.currentMeta}>
                  {currentOrder.orderType === 'DELIVERY' ? 'Delivery' : currentOrder.orderType === 'DINE_IN' ? 'Dine-in' : 'Pickup'}
                  {currentOrder.createdAt ? ` · ${new Date(currentOrder.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                </Text>
              </View>
              <StatusBadge status={currentOrder.orderStatus} />
            </View>
            <OrderStatusTimeline
              currentStatus={currentOrder.orderStatus}
              orderType={currentOrder.orderType || 'TAKEAWAY'}
              order={currentOrder}
            />
            <View style={styles.currentFooter}>
              <Text style={styles.currentTotal}>Total ₹{currentOrder.totalAmount}</Text>
              <TouchableOpacity onPress={() => router.push(`/order-tracking/${currentOrder._id}`)} accessibilityRole="button" accessibilityLabel="Open full order tracking">
                <Text style={styles.currentLink}>View order</Text>
              </TouchableOpacity>
            </View>
          </View>
          <OrderCard order={currentOrder} />
        </Animated.ScrollView>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title={view === 'ACTIVE' ? 'Nothing cooking right now' : view === 'COMPLETED' ? 'No past orders yet' : 'No orders yet'}
          message={view === 'ACTIVE'
            ? 'When you place an order it will show up here with live updates.'
            : 'You have not placed any food orders yet. Explore our delicious menu!'}
          buttonTitle={view === 'ACTIVE' || view === 'COMPLETED' || view === 'CURRENT' ? 'Browse the menu' : undefined}
          onButtonPress={() => router.push('/(tabs)/home')}
        />
      ) : (
        <Animated.View style={{ flex: 1, opacity: listFade }}>
          <FlatList
            data={filteredOrders}
            ListHeaderComponent={loadError ? <Text style={styles.refreshWarning}>Could not refresh. Showing the last loaded order history.</Text> : null}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={styles.orderCardWrapper}>
                <OrderCard order={item} />
                {isPast(item) && ['COMPLETED', 'DELIVERED', 'SERVED'].includes(item.orderStatus) && (
                  <View style={styles.reorderBtnContainer}>
                    <Button
                      title="Reorder"
                      onPress={() => handleReorder(item._id)}
                      loading={reordering === item._id}
                      style={styles.reorderBtn}
                    />
                  </View>
                )}
              </View>
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  rapoPanel: { paddingHorizontal: 16, paddingBottom: 12 },
  rapoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rapoBubble: {
    flex: 1, minWidth: 0, backgroundColor: COLORS.parchment, borderRadius: 16, borderTopLeftRadius: 5,
    borderWidth: 1, borderColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 9,
  },
  rapoKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.3, color: COLORS.goldDeep, marginBottom: 2 },
  rapoText: { fontSize: 12.5, lineHeight: 18, color: COLORS.cocoa, fontWeight: '600' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  choice: {
    flexGrow: 1, flexBasis: '46%', minWidth: 0, minHeight: 56,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 11, paddingVertical: 9,
    borderRadius: THEME.radius.md, backgroundColor: COLORS.cardBackground,
    borderWidth: 1, borderColor: COLORS.border,
  },
  choiceActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDark },
  choiceCopy: { flex: 1, minWidth: 0 },
  choiceLabel: { fontSize: 12.5, fontWeight: '900', color: COLORS.textPrimary },
  choiceLabelActive: { color: '#FFFFFF' },
  choiceHint: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
  choiceHintActive: { color: 'rgba(255,255,255,0.82)' },
  currentContent: { paddingHorizontal: 16, paddingBottom: 24, maxWidth: 780, width: '100%', alignSelf: 'center' },
  currentCard: {
    backgroundColor: COLORS.cardBackground, borderRadius: THEME.radius.lg, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, ...THEME.shadow.soft,
  },
  currentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  currentKicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.4, color: COLORS.goldDeep },
  currentNumber: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary, marginTop: 2 },
  currentMeta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  currentFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  currentTotal: { fontSize: 14, fontWeight: '900', color: COLORS.primaryDark },
  currentLink: { fontSize: 12.5, fontWeight: '900', color: COLORS.primaryDark },
  orderCardWrapper: { marginBottom: 16 },
  reorderBtnContainer: { marginTop: -20, marginBottom: 10, paddingHorizontal: 10 },
  reorderBtn: { paddingVertical: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, maxWidth: 780, width: '100%', alignSelf: 'center' },
  refreshWarning: { color: COLORS.warning, backgroundColor: COLORS.warningLight, borderRadius: 10, padding: 10, fontSize: 11.5, marginBottom: 10 },
});
