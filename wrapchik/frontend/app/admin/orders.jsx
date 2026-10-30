import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import Header from '../../components/common/Header';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import EmptyState from '../../components/common/EmptyState';
import adminService from '../../services/adminService';
import { SocketContext } from '../../context/SocketContext';
import COLORS from '../../constants/colors';

export default function AdminOrdersScreen() {
  const { socket } = React.useContext(SocketContext);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  useEffect(() => {
    fetchAdminOrders();
  }, [selectedFilter]);

  useEffect(() => {
    if (!socket) return;
    const handleNewOrder = (data) => {
      fetchAdminOrders();
    };
    const handleOrderUpdate = (data) => {
      setOrders(prev => prev.map(o => 
        o._id === data.orderId ? { ...o, orderStatus: data.orderStatus } : o
      ));
    };
    socket.on('new_order', handleNewOrder);
    socket.on('order_updated', handleOrderUpdate);
    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_updated', handleOrderUpdate);
    };
  }, [socket]);

  const fetchAdminOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const params = selectedFilter !== 'ALL' ? { status: selectedFilter } : {};
      const res = await adminService.getAllOrders(params);

      if (res && res.orders) {
        setOrders(res.orders);
      } else {
        setOrders([]);
      }
    } catch (e) {
      setError(e.message || 'Unable to load orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAdminOrders();
  };

  const handleUpdateStatus = async (orderId, newStatus, reason = '') => {
    if (updatingId) return;
    setUpdatingId(orderId);
    setError('');
    try {
      const res = await adminService.updateOrderStatus(orderId, newStatus, reason);
      if (!res?.order) throw new Error('Order update was not confirmed.');
      setOrders(prev => prev.map(order => order._id === orderId ? res.order : order));
    } catch (e) {
      setError(e.message || 'Unable to update order.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectOrder = (orderId) => {
    if (typeof window !== 'undefined') {
      if (confirm('Are you sure you want to reject this order?')) {
        handleUpdateStatus(orderId, 'REJECTED', 'Kitchen overload');
      }
    } else {
      Alert.alert('Reject Order', 'Are you sure you want to reject this order?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => handleUpdateStatus(orderId, 'REJECTED', 'Kitchen overload'),
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Manage Orders" showBack showCart={false} />

      {error ? <View style={{padding:16}}><Text accessibilityRole="alert" style={{color:COLORS.danger}}>{error}</Text><Button title="Retry" onPress={fetchAdminOrders} /></View> : null}
      <Button title="Refresh orders" variant="outline" onPress={handleRefresh} loading={refreshing} />
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['ALL', 'PLACED', 'PREPARING', 'READY', 'COMPLETED'].map((filter) => (
          <TouchableOpacity
            key={filter}
            onPress={() => setSelectedFilter(filter)}
            style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <LoadingIndicator message="Fetching incoming orders..." />
      ) : error && orders.length === 0 ? null : orders.length === 0 ? (
        <EmptyState title="No Orders" message="No orders match the selected status filter." />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
          }
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderNum}>Order #{item.orderNumber}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                    <Text style={[
                      styles.orderTypeBadge,
                      item.orderType === 'DELIVERY' && styles.deliveryBadge,
                      item.orderType === 'DINE_IN' && styles.dineInBadge
                    ]}>
                      {item.orderType || 'TAKEAWAY'}
                    </Text>
                    <Text style={styles.customerName}>
                      👤 {item.userId?.name || 'Student'} • 📱 {item.userId?.phone || 'N/A'}
                    </Text>
                  </View>
                </View>
                <StatusBadge status={item.orderStatus} />
              </View>

              <View style={styles.divider} />

              <View style={styles.itemsSummary}>
                {item.items?.map((it, idx) => (
                  <Text key={idx} style={styles.itemText}>
                    {it.quantity} × {it.name} (₹{it.priceAtPurchase * it.quantity})
                  </Text>
                ))}
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.totalVal}>Total: ₹{item.totalAmount}</Text>

                {/* State Machine Action Controls */}
                <View style={styles.actionsRow}>
                  {item.orderStatus === 'PLACED' && (
                    <>
                      <Button
                        title="Accept"
                        onPress={() => handleUpdateStatus(item._id, 'ACCEPTED')}
                        disabled={!!updatingId}
                        style={styles.actionBtnSmall}
                      />
                      <Button
                        title="Reject"
                        variant="danger"
                        onPress={() => handleRejectOrder(item._id)}
                        disabled={!!updatingId}
                        style={styles.actionBtnSmall}
                      />
                    </>
                  )}

                  {item.orderStatus === 'ACCEPTED' && (
                    <Button
                      title="Start Preparing"
                      onPress={() => handleUpdateStatus(item._id, 'PREPARING')}
                      disabled={!!updatingId}
                      style={styles.actionBtnFull}
                    />
                  )}

                  {item.orderStatus === 'PREPARING' && (
                    <Button
                      title={item.orderType === 'DINE_IN' ? "Mark as Served" : "Mark Ready for Pickup"}
                      onPress={() => handleUpdateStatus(item._id, item.orderType === 'DINE_IN' ? 'SERVED' : 'READY')}
                      disabled={!!updatingId}
                      style={styles.actionBtnFull}
                    />
                  )}

                  {item.orderStatus === 'READY' && (
                    <Button
                      title={item.orderType === 'DELIVERY' ? "Mark Picked Up" : "Mark Completed"}
                      onPress={() => handleUpdateStatus(item._id, item.orderType === 'DELIVERY' ? 'PICKED_UP' : 'COMPLETED')}
                      disabled={!!updatingId}
                      style={styles.actionBtnFull}
                    />
                  )}

                  {item.orderStatus === 'PICKED_UP' && item.orderType === 'DELIVERY' && (
                    <Button
                      title="Mark Delivered"
                      onPress={() => handleUpdateStatus(item._id, 'DELIVERED')}
                      disabled={!!updatingId}
                      style={styles.actionBtnFull}
                    />
                  )}

                  {item.orderStatus === 'SERVED' && item.orderType === 'DINE_IN' && (
                    <Button
                      title="Mark Completed"
                      onPress={() => handleUpdateStatus(item._id, 'COMPLETED')}
                      disabled={!!updatingId}
                      style={styles.actionBtnFull}
                    />
                  )}
                </View>
              </View>
            </View>
          )}
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNum: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  orderTypeBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    color: '#FFF',
  },
  deliveryBadge: {
    backgroundColor: COLORS.info,
  },
  dineInBadge: {
    backgroundColor: COLORS.success,
  },
  customerName: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  itemsSummary: {
    marginBottom: 10,
  },
  itemText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  cardFooter: {
    marginTop: 4,
  },
  totalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnSmall: {
    flex: 1,
    height: 40,
  },
  actionBtnFull: {
    width: '100%',
    height: 40,
  },
});
