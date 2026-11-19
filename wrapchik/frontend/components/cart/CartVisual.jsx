import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { ShoppingBag, Sparkles } from 'lucide-react-native';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const SLOTS = [
  { left: '18%', top: '30%', rotate: '-9deg', size: 40 },
  { left: '38%', top: '20%', rotate: '6deg', size: 44 },
  { left: '58%', top: '30%', rotate: '-4deg', size: 40 },
  { left: '30%', top: '48%', rotate: '7deg', size: 38 },
  { left: '52%', top: '48%', rotate: '-6deg', size: 38 },
];

function Basket() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 240 150" fill="none">
      <Defs>
        <LinearGradient id="basketBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD9BE" />
          <Stop offset="1" stopColor="#F7BE93" />
        </LinearGradient>
        <LinearGradient id="basketRim" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={COLORS.primary} />
          <Stop offset="1" stopColor={COLORS.primaryDark} />
        </LinearGradient>
      </Defs>

      {/* handle */}
      <Path d="M78 40C78 8 162 8 162 40" stroke={COLORS.cocoaSoft} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.55" />
      <Path d="M78 40C78 12 162 12 162 40" stroke={COLORS.gold} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9" />

      {/* body */}
      <Path d="M32 44H208L190 128a8 8 0 0 1-7.9 6.6H57.9A8 8 0 0 1 50 128L32 44Z" fill="url(#basketBody)" stroke={COLORS.cocoa} strokeWidth="3" strokeLinejoin="round" />
      {/* rim */}
      <Path d="M28 40h184a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4Z" fill="url(#basketRim)" stroke={COLORS.cocoa} strokeWidth="2.5" />
      {/* slats */}
      <G opacity="0.5" stroke={COLORS.cocoa} strokeWidth="2" strokeLinecap="round">
        <Path d="M60 56 74 132" />
        <Path d="M96 56 102 134" />
        <Path d="M132 56 130 134" />
        <Path d="M168 56 158 132" />
        <Path d="M46 80h158" />
        <Path d="M52 106h150" />
      </G>
      {/* shine */}
      <Path d="M52 52l10 66" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
      {/* wheels */}
      <Circle cx="76" cy="140" r="7" fill={COLORS.cocoa} opacity="0.85" />
      <Circle cx="164" cy="140" r="7" fill={COLORS.cocoa} opacity="0.85" />
      <Circle cx="76" cy="140" r="2.6" fill={COLORS.parchment} />
      <Circle cx="164" cy="140" r="2.6" fill={COLORS.parchment} />
    </Svg>
  );
}

/**
 * A stylised 3D cart built from vectors and CSS-style transforms: it tilts
 * gently, holds a chip for each item in the real cart, and hops whenever the
 * bag contents change. No 3D engine, no extra bundle weight.
 */
export default function CartVisual({ items = [], count = 0 }) {
  const reducedMotion = useReducedMotion();
  const tilt = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const lastCount = useRef(count);

  useEffect(() => {
    if (reducedMotion) { tilt.setValue(0); return undefined; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tilt, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(tilt, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, tilt]);

  useEffect(() => {
    if (lastCount.current === count) return;
    const grew = count > lastCount.current;
    lastCount.current = count;
    if (reducedMotion) return;
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(hop, { toValue: 0, friction: 4, tension: 130, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    if (grew) {
      // A tiny settle after the hop reads as "something landed in the bag".
      Animated.sequence([
        Animated.delay(160),
        Animated.timing(hop, { toValue: 0.35, duration: 120, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(hop, { toValue: 0, friction: 5, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
  }, [count, hop, reducedMotion]);

  const visibleItems = items.slice(0, SLOTS.length);
  const rotateY = tilt.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] });
  const translateY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const scale = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const shadowScale = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.stage, { transform: [{ perspective: 900 }, { rotateX: '14deg' }, { rotateY }, { translateY }, { scale }] }]}>
        <View style={styles.basket}>
          <Basket />
        </View>

        {visibleItems.map((item, index) => (
          <View
            key={item.cartKey || `${item.productId}-${index}`}
            style={[
              styles.chip,
              {
                left: SLOTS[index].left,
                top: SLOTS[index].top,
                width: SLOTS[index].size,
                height: SLOTS[index].size,
                transform: [{ rotate: SLOTS[index].rotate }],
              },
            ]}
          >
            {item.imageUrl
              ? <Image source={{ uri: item.imageUrl }} style={styles.chipImage} resizeMode="cover" />
              : <ShoppingBag size={18} color={COLORS.primaryDark} />}
            {item.quantity > 1 ? (
              <View style={styles.qtyBadge}><Text style={styles.qtyText}>{item.quantity}</Text></View>
            ) : null}
          </View>
        ))}

        {!visibleItems.length ? (
          <View style={styles.emptyBasket}>
            <Text style={styles.emptyText}>Your bag is waiting</Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.shadow, { transform: [{ scale: shadowScale }] }]} />

      <View style={styles.counter}>
        <Sparkles size={12} color={COLORS.goldDeep} />
        <Text style={styles.counterText}>
          {count > 0
            ? `${count} ${count === 1 ? 'item' : 'items'} tucked in your bag`
            : 'Add something delicious to see it here'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 6, paddingBottom: 4 },
  stage: {
    width: '100%',
    maxWidth: 340,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  basket: { width: '100%', height: '100%' },
  chip: {
    position: 'absolute',
    borderRadius: 12,
    backgroundColor: COLORS.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.goldLight,
    overflow: 'visible',
    ...THEME.shadow.soft,
  },
  chipImage: { width: '100%', height: '100%', borderRadius: 10 },
  qtyBadge: {
    position: 'absolute', right: -6, top: -6, minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.background,
  },
  qtyText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  emptyBasket: {
    position: 'absolute', top: '46%', left: 0, right: 0, alignItems: 'center',
  },
  emptyText: { fontSize: 11, fontWeight: '800', color: COLORS.cocoaSoft, opacity: 0.8 },
  shadow: {
    width: 210, height: 16, borderRadius: 105, marginTop: -6,
    backgroundColor: COLORS.cocoa, opacity: 0.1,
  },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  counterText: { fontSize: 11.5, fontWeight: '800', color: COLORS.cocoaSoft },
});
