import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import OrderCard from '../../components/order/OrderCard';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import orderService from '../../services/orderService';
import COLORS from '../../constants/colors';
import { SocketContext } from '../../context/SocketContext';

export default function OrdersScreen() {
  const router = useRouter();
  const { addToCart } = useContext(CartContext);
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL'); // ALL, ACTIVE, COMPLETED
  const [loadError, setLoadError] = useState(false);
  const [reordering, setReordering] = useState(null);

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

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ACTIVE') {
      return ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP'].includes(o.orderStatus);
    }
    if (filter === 'COMPLETED') {
      return ['COMPLETED', 'DELIVERED', 'SERVED', 'REJECTED', 'CANCELLED'].includes(o.orderStatus);
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <Header title="My Orders" showCart={false} />

      {/* Filter Tabs */}
      {user ? <View style={styles.filterContainer}>
        {['ALL', 'ACTIVE', 'COMPLETED'].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setFilter(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === tab }}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {tab === 'ALL' ? 'All Orders' : tab === 'ACTIVE' ? 'Live Orders' : 'Past Orders'}
            </Text>
          </TouchableOpacity>
        ))}
      </View> : null}

      {authLoading ? (
        <LoadingIndicator message="Restoring your session…" />
      ) : !user ? (
        <EmptyState title="Sign in to view your orders" message="Your order status and receipts are saved to your Wrapchik account." buttonTitle="Sign in" onButtonPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: 'orders' } })} />
      ) : loadError && !loading && orders.length === 0 ? (
        <ErrorState title="Could not load your orders" message="Check your connection and retry. Your order history has not been cleared." onRetry={handleRefresh} retrying={refreshing} />
      ) : loading && !refreshing ? (
        <LoadingIndicator message="Loading your order history..." />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No Orders Found"
          message="You haven't placed any food orders yet. Explore our delicious menu!"
        />
      ) : (
        <FlatList
          data={filteredOrders}
          ListHeaderComponent={loadError ? <Text style={styles.refreshWarning}>Could not refresh. Showing the last loaded order history.</Text> : null}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.orderCardWrapper}>
              <OrderCard order={item} />
              {['COMPLETED', 'DELIVERED', 'SERVED'].includes(item.orderStatus) && (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  orderCardWrapper: {
    marginBottom: 16,
  },
  reorderBtnContainer: {
    marginTop: -20,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  reorderBtn: {
    paddingVertical: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  refreshWarning: { color: COLORS.warning, backgroundColor: COLORS.warningLight, padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 12, fontWeight: '700' },
});
