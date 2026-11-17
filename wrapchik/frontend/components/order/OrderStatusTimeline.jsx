import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Check, CookingPot, PackageCheck, Sparkles, Bike, UtensilsCrossed, Heart } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';
import useReducedMotion from '../../hooks/useReducedMotion';

const baseSteps = [
  { status: 'PLACED', title: 'Order received', desc: 'Wrapoo tucked your order safely into the kitchen queue.', Icon: Heart },
  { status: 'ACCEPTED', title: 'In the kitchen', desc: 'The team has your order and is getting things ready.', Icon: Sparkles },
  { status: 'PREPARING', title: 'Cooking magic', desc: 'Fresh wraps, warm griddle, a little enchantment.', Icon: CookingPot },
];

const TAKEAWAY_STEPS = [
  ...baseSteps,
  { status: 'READY', title: 'Ready', desc: 'Hot and wrapped — collect it at the Wrapchik counter.', Icon: PackageCheck },
  { status: 'COMPLETED', title: 'Collected', desc: 'Enjoy every bite. Wrapoo is doing a happy dance.', Icon: Check },
];

const DELIVERY_STEPS = [
  ...baseSteps,
  { status: 'READY', title: 'Ready', desc: 'Wrapped, bagged and waiting for the delivery run.', Icon: PackageCheck },
  { status: 'PICKED_UP', title: 'On its way', desc: 'Your food is travelling across campus to you.', Icon: Bike },
  { status: 'DELIVERED', title: 'Delivered', desc: 'Delivered with a little sparkle. Enjoy!', Icon: Check },
];

const DINE_IN_STEPS = [
  ...baseSteps,
  { status: 'SERVED', title: 'Served', desc: 'Your food has arrived at your table.', Icon: UtensilsCrossed },
  { status: 'COMPLETED', title: 'Completed', desc: 'Thanks for dining with us. Come back soon!', Icon: Check },
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

const formatStepTime = (value) => value
  ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  : null;

function JourneyStep({ step, index, isPassed, isCurrent, isLast, stepTime, reducedMotion }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const IconComponent = step.Icon;

  useEffect(() => {
    if (!isCurrent || reducedMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isCurrent, pulse, reducedMotion]);

  return (
    <View style={styles.stepRow}>
      <View style={styles.leftCol}>
        <Animated.View
          style={[
            styles.circle,
            isPassed && styles.circlePassed,
            isCurrent && styles.circleCurrent,
            isCurrent ? { transform: [{ scale: pulse }] } : null,
          ]}
        >
          {isPassed && !isCurrent
            ? <Check size={16} color="#FFFFFF" />
            : <IconComponent size={17} color={isCurrent ? '#FFFFFF' : isPassed ? '#FFFFFF' : COLORS.cocoaMuted} />}
        </Animated.View>
        {!isLast ? <View style={[styles.line, isPassed && styles.linePassed]} /> : null}
      </View>

      <View style={[styles.rightCol, isLast && styles.rightColLast]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isPassed && styles.titlePassed, isCurrent && styles.titleCurrent]}>
            {step.title}
          </Text>
          {isCurrent ? (
            <View style={styles.nowPill}><Sparkles size={10} color={COLORS.goldDeep} /><Text style={styles.nowText}>NOW</Text></View>
          ) : null}
        </View>
        <Text style={[styles.desc, isCurrent && styles.descCurrent]}>{step.desc}</Text>
        {isPassed && stepTime ? <Text style={styles.stepTime}>{stepTime}</Text> : null}
      </View>
    </View>
  );
}

const OrderStatusTimeline = ({ currentStatus, orderType = 'TAKEAWAY', order }) => {
  const reducedMotion = useReducedMotion();

  if (currentStatus === 'REJECTED' || currentStatus === 'CANCELLED') {
    return (
      <View style={styles.cancelledBox}>
        <Text style={styles.cancelledTitle}>Order {currentStatus.toLowerCase()}</Text>
        <Text style={styles.cancelledDesc}>
          {currentStatus === 'REJECTED' && order?.rejectionReason
            ? `Reason: ${order.rejectionReason}`
            : `This order was ${currentStatus.toLowerCase()}. Contact support if you need a hand.`}
        </Text>
        {formatStepTime(currentStatus === 'REJECTED' ? order?.rejectedAt : order?.cancelledAt)
          ? <Text style={styles.stepTime}>{formatStepTime(currentStatus === 'REJECTED' ? order?.rejectedAt : order?.cancelledAt)}</Text>
          : null}
      </View>
    );
  }

  let steps = TAKEAWAY_STEPS;
  if (orderType === 'DELIVERY') steps = DELIVERY_STEPS;
  if (orderType === 'DINE_IN') steps = DINE_IN_STEPS;

  const currentIndex = steps.findIndex((step) => step.status === currentStatus);
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isPassed = index <= safeIndex;
        const stepTime = formatStepTime(index === 0 ? order?.createdAt : order?.[STEP_TIMESTAMP_FIELDS[step.status]]);
        return (
          <JourneyStep
            key={step.status}
            step={step}
            index={index}
            isPassed={isPassed}
            isCurrent={index === safeIndex}
            isLast={index === steps.length - 1}
            stepTime={stepTime}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 66 },
  leftCol: { alignItems: 'center', width: 38 },
  circle: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surfaceMuted,
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  circlePassed: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  circleCurrent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.goldLight,
    borderWidth: 4,
    ...THEME.shadow.gold,
  },
  line: { width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: 3, borderRadius: 2 },
  linePassed: { backgroundColor: COLORS.gold },
  rightCol: { flex: 1, marginLeft: 13, paddingTop: 3, paddingBottom: 14 },
  rightColLast: { paddingBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.cocoaMuted },
  titlePassed: { color: COLORS.textPrimary, fontWeight: '800' },
  titleCurrent: { color: COLORS.primaryDark, fontWeight: '900', fontSize: 16 },
  nowPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.goldLight,
    borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
  },
  nowText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8, color: COLORS.goldDeep },
  desc: { fontSize: 12, color: COLORS.cocoaMuted, marginTop: 3, lineHeight: 17 },
  descCurrent: { color: COLORS.textSecondary },
  stepTime: { fontSize: 10.5, color: COLORS.cocoaMuted, marginTop: 4 },
  cancelledBox: {
    padding: 16, backgroundColor: COLORS.dangerLight, borderRadius: THEME.radius.md,
    alignItems: 'center', borderWidth: 1, borderColor: '#F2C8C0',
  },
  cancelledTitle: { fontSize: 16, fontWeight: '900', color: COLORS.danger, marginBottom: 4 },
  cancelledDesc: { fontSize: 13, color: COLORS.textPrimary, textAlign: 'center', lineHeight: 19 },
});

export default OrderStatusTimeline;
