import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';
import useReducedMotion from '../../hooks/useReducedMotion';

function useShimmer() {
  const reducedMotion = useReducedMotion();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, shimmer]);

  return shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });
}

function ProductSkeleton({ shimmer }) {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.image, { opacity: shimmer }]} />
      <View style={styles.content}>
        <Animated.View style={[styles.line, styles.name, { opacity: shimmer }]} />
        <Animated.View style={[styles.line, styles.description, { opacity: shimmer }]} />
        <View style={styles.footer}>
          <Animated.View style={[styles.line, styles.price, { opacity: shimmer }]} />
          <Animated.View style={[styles.add, { opacity: shimmer }]} />
        </View>
      </View>
    </View>
  );
}

export default function ProductListSkeleton({ count = 3 }) {
  const shimmer = useShimmer();
  return (
    <View accessibilityLabel="Sprinkling the menu into place" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, index) => <ProductSkeleton key={index} shimmer={shimmer} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', padding: 12, marginBottom: 12, borderRadius: THEME.radius.lg,
    backgroundColor: COLORS.cardBackground, borderWidth: 1, borderColor: COLORS.border,
  },
  image: { width: 96, height: 96, borderRadius: THEME.radius.md, backgroundColor: COLORS.surfaceMuted },
  content: { flex: 1, marginLeft: 14, justifyContent: 'space-between', paddingVertical: 3 },
  line: { backgroundColor: COLORS.surfaceMuted, borderRadius: 7 },
  name: { height: 16, width: '68%' },
  description: { height: 26, width: '90%' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { height: 16, width: 46 },
  add: { height: 34, width: 72, borderRadius: THEME.radius.pill, backgroundColor: COLORS.primaryLight },
});
