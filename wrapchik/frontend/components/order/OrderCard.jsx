import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import StatusBadge from '../common/StatusBadge';
import COLORS from '../../constants/colors';

const OrderCard = ({ order }) => {
  const router = useRouter();

  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      onPress={() => router.push(`/order-tracking/${order._id}`)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.orderNumber}, ${String(order.orderStatus || 'unknown').toLowerCase()}, total ₹${order.totalAmount}. Open details`}
      style={styles.card}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
          <View style={styles.badges}><StatusBadge status={order.orderStatus} /><StatusBadge status={order.paymentStatus} /></View>
      </View>

      <View style={styles.divider} />

      <View style={styles.itemsSummary}>
        {(order.items || []).slice(0, 3).map((item, idx) => (
          <Text key={idx} style={styles.itemText} numberOfLines={1}>
            {item.quantity} × {item.name}
          </Text>
        ))}
        {(order.items || []).length > 3 ? <Text style={styles.moreItems}>+{order.items.length - 3} more items</Text> : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalAmount}>₹{order.totalAmount}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badges: { alignItems: 'flex-end', gap: 5 },
  orderNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  itemsSummary: {
    marginBottom: 8,
  },
  itemText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  moreItems: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 6,
  },
  totalLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
});

export default OrderCard;
