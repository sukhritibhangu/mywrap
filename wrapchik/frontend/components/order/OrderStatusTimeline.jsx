import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, Clock, PackageCheck, CookingPot, CircleDot } from 'lucide-react-native';
import COLORS from '../../constants/colors';

const TAKEAWAY_STEPS = [
  { status: 'PLACED', title: 'Order Placed', desc: 'Shopkeeper received your order', Icon: Clock },
  { status: 'ACCEPTED', title: 'Order Accepted', desc: 'Order confirmed by Wrapchik kitchen', Icon: CircleDot },
  { status: 'PREPARING', title: 'Preparing Food', desc: 'Chef is wrapping your fresh food', Icon: CookingPot },
  { status: 'READY', title: 'Ready for Pickup', desc: 'Head to Wrapchik SAC counter!', Icon: PackageCheck },
  { status: 'COMPLETED', title: 'Order Completed', desc: 'Enjoy your fresh meal!', Icon: CheckCircle2 },
];

const DELIVERY_STEPS = [
  { status: 'PLACED', title: 'Order Placed', desc: 'Shopkeeper received your order', Icon: Clock },
  { status: 'ACCEPTED', title: 'Order Accepted', desc: 'Order confirmed by Wrapchik kitchen', Icon: CircleDot },
  { status: 'PREPARING', title: 'Preparing Food', desc: 'Chef is wrapping your fresh food', Icon: CookingPot },
  { status: 'READY', title: 'Ready for Delivery', desc: 'Order is ready to be picked up', Icon: PackageCheck },
  { status: 'PICKED_UP', title: 'Picked Up', desc: 'Delivery partner has picked up your order', Icon: CircleDot },
  { status: 'DELIVERED', title: 'Delivered', desc: 'Enjoy your fresh meal!', Icon: CheckCircle2 },
];

const DINE_IN_STEPS = [
  { status: 'PLACED', title: 'Order Placed', desc: 'Shopkeeper received your order', Icon: Clock },
  { status: 'ACCEPTED', title: 'Order Accepted', desc: 'Order confirmed by Wrapchik kitchen', Icon: CircleDot },
  { status: 'PREPARING', title: 'Preparing Food', desc: 'Chef is wrapping your fresh food', Icon: CookingPot },
  { status: 'SERVED', title: 'Served', desc: 'Food served at your table!', Icon: CheckCircle2 },
  { status: 'COMPLETED', title: 'Order Completed', desc: 'Enjoy your fresh meal!', Icon: CheckCircle2 },
];

const STEP_TIMESTAMP_FIELDS = {
  ACCEPTED: 'acceptedAt',
  PREPARING: 'preparingAt',
  READY: 'readyAt',
  PICKED_UP: 'pickedUpAt',
  DELIVERED: 'deliveredAt',
  SERVED: 'servedAt',
  COMPLETED: 'completedAt',
};
const formatStepTime = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null;

const OrderStatusTimeline = ({ currentStatus, orderType = 'TAKEAWAY', order }) => {
  if (currentStatus === 'REJECTED' || currentStatus === 'CANCELLED') {
    return (
      <View style={styles.cancelledBox}>
        <Text style={styles.cancelledTitle}>Order {currentStatus}</Text>
        <Text style={styles.cancelledDesc}>{currentStatus === 'REJECTED' && order?.rejectionReason ? `Reason: ${order.rejectionReason}` : `This order was ${currentStatus.toLowerCase()}. Contact support if you require assistance.`}</Text>
        {formatStepTime(currentStatus === 'REJECTED' ? order?.rejectedAt : order?.cancelledAt) ? <Text style={styles.stepTime}>{formatStepTime(currentStatus === 'REJECTED' ? order?.rejectedAt : order?.cancelledAt)}</Text> : null}
      </View>
    );
  }

  let steps = TAKEAWAY_STEPS;
  if (orderType === 'DELIVERY') steps = DELIVERY_STEPS;
  if (orderType === 'DINE_IN') steps = DINE_IN_STEPS;

  const getStepIndex = (st) => {
    return steps.findIndex((s) => s.status === st);
  };

  const currentIndex = getStepIndex(currentStatus);

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isPassed = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const IconComponent = step.Icon;
        const stepTime = formatStepTime(index === 0 ? order?.createdAt : order?.[STEP_TIMESTAMP_FIELDS[step.status]]);

        return (
          <View key={step.status} style={styles.stepRow}>
            <View style={styles.leftCol}>
              <View
                style={[
                  styles.circle,
                  isPassed && styles.circlePassed,
                  isCurrent && styles.circleCurrent,
                ]}
              >
                <IconComponent
                  size={18}
                  color={isPassed ? '#FFFFFF' : COLORS.textSecondary}
                />
              </View>
              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.line,
                    index < currentIndex && styles.linePassed,
                  ]}
                />
              )}
            </View>

            <View style={styles.rightCol}>
              <Text
                style={[
                  styles.title,
                  isPassed && styles.titlePassed,
                  isCurrent && styles.titleCurrent,
                ]}
              >
                {step.title}
              </Text>
              <Text style={styles.desc}>{step.desc}</Text>
              {isPassed && stepTime ? <Text style={styles.stepTime}>{stepTime}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 64,
  },
  leftCol: {
    alignItems: 'center',
    width: 36,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  circlePassed: {
    backgroundColor: COLORS.success,
  },
  circleCurrent: {
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  linePassed: {
    backgroundColor: COLORS.success,
  },
  rightCol: {
    flex: 1,
    marginLeft: 12,
    paddingTop: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  titlePassed: {
    color: COLORS.textPrimary,
  },
  titleCurrent: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  desc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  stepTime: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  cancelledBox: {
    padding: 16,
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelledTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.danger,
    marginBottom: 4,
  },
  cancelledDesc: {
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
});

export default OrderStatusTimeline;
