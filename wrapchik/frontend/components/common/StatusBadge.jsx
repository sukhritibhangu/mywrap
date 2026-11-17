import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import COLORS from '../../constants/colors';

const STATUS_CONFIG = {
  PLACED: { label: 'Order received', bg: COLORS.infoLight, text: COLORS.info },
  ACCEPTED: { label: 'In the kitchen', bg: COLORS.warningLight, text: COLORS.warning },
  PREPARING: { label: 'Cooking magic', bg: COLORS.warningLight, text: COLORS.warning },
  READY: { label: 'Ready!', bg: COLORS.successLight, text: COLORS.success },
  COMPLETED: { label: 'Collected', bg: COLORS.successLight, text: COLORS.success },
  PICKED_UP: { label: 'On its way', bg: COLORS.infoLight, text: COLORS.info },
  DELIVERED: { label: 'Delivered', bg: COLORS.successLight, text: COLORS.success },
  SERVED: { label: 'Served', bg: COLORS.successLight, text: COLORS.success },
  REJECTED: { label: 'Rejected', bg: COLORS.dangerLight, text: COLORS.danger },
  CANCELLED: { label: 'Cancelled', bg: COLORS.dangerLight, text: COLORS.danger },
  SUCCESS: { label: 'Paid', bg: COLORS.successLight, text: COLORS.success },
  PENDING: { label: 'Payment pending', bg: COLORS.warningLight, text: COLORS.warning },
  FAILED: { label: 'Payment failed', bg: COLORS.dangerLight, text: COLORS.danger },
};

const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || { label: String(status || 'Unknown').replaceAll('_', ' '), bg: COLORS.surfaceMuted, text: COLORS.cocoaSoft };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]} accessibilityLabel={`Status: ${config.label}`}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.1 },
});

export default StatusBadge;
