import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';

function Tomato({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="14" r="8" fill="#F16B4A" />
      <Path d="M12 7c-1-2-3-3-5-2 1 2 2 3 5 3Zm0 0c1-2 3-3 5-2-1 2-2 3-5 3Z" fill="#5C8C46" />
    </Svg>
  );
}
function Basil({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 19C4 10 11 4 20 4c0 9-6 16-15 16Z" fill="#6E9A54" />
      <Path d="M5 18C9 14 13 10 19 5" stroke="#D8EAC4" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}
function Cheese({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 17 21 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="#F4C95D" />
      <Circle cx="10" cy="15.5" r="1.6" fill="#E4AE33" />
      <Circle cx="16" cy="13" r="1.2" fill="#E4AE33" />
    </Svg>
  );
}
function Star({ size, color = COLORS.gold }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m12 2 2.5 6.2L21 10l-5 4.3L17.3 21 12 17.4 6.7 21 8 14.3 3 10l6.5-1.8L12 2Z" fill={color} />
    </Svg>
  );
}

const FLOATERS = [
  { kind: 'tomato', size: 26, left: '6%', top: '14%', drift: 12, delay: 0, duration: 6200, rotate: '-10deg' },
  { kind: 'basil', size: 30, left: '82%', top: '12%', drift: 16, delay: 400, duration: 7600, rotate: '16deg' },
  { kind: 'cheese', size: 28, left: '72%', top: '62%', drift: 10, delay: 900, duration: 6800, rotate: '-8deg' },
  { kind: 'tomato', size: 18, left: '42%', top: '78%', drift: 14, delay: 1400, duration: 8200, rotate: '12deg' },
  { kind: 'basil', size: 22, left: '14%', top: '66%', drift: 18, delay: 700, duration: 7200, rotate: '-20deg' },
  { kind: 'star', size: 14, left: '30%', top: '8%', drift: 8, delay: 200, duration: 5000, rotate: '0deg' },
  { kind: 'star', size: 10, left: '62%', top: '30%', drift: 10, delay: 1200, duration: 5800, rotate: '0deg' },
  { kind: 'star', size: 12, left: '90%', top: '44%', drift: 6, delay: 1600, duration: 5400, rotate: '0deg' },
  { kind: 'star', size: 9, left: '22%', top: '38%', drift: 12, delay: 800, duration: 6300, rotate: '0deg' },
];

function Floater({ item, reducedMotion }) {
  const bob = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(item.delay),
        Animated.timing(bob, { toValue: 1, duration: item.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(bob, { toValue: 0, duration: item.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    let twinkleLoop;
    if (item.kind === 'star') {
      twinkleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(twinkle, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(twinkle, { toValue: 0.35, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        ]),
      );
      twinkleLoop.start();
    }
    return () => { loop.stop(); twinkleLoop?.stop(); };
  }, [bob, item.delay, item.duration, item.kind, reducedMotion, twinkle]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -item.drift] });
  const style = useMemo(() => ([
    styles.floater,
    { left: item.left, top: item.top },
    { transform: [{ translateY }, { rotate: item.rotate }] },
    item.kind === 'star' ? { opacity: twinkle } : { opacity: 0.85 },
  ]), [item.kind, item.left, item.rotate, item.top, translateY, twinkle]);

  return (
    <Animated.View pointerEvents="none" style={style}>
      {item.kind === 'tomato' ? <Tomato size={item.size} /> : null}
      {item.kind === 'basil' ? <Basil size={item.size} /> : null}
      {item.kind === 'cheese' ? <Cheese size={item.size} /> : null}
      {item.kind === 'star' ? <Star size={item.size} /> : null}
    </Animated.View>
  );
}

/**
 * Soft enchanted-café atmosphere: warm washes, gentle sparkles and floating
 * ingredients. Purely decorative, pointer-transparent, calm under reduced motion.
 */
export default function EnchantedBackdrop({ intensity = 'full' }) {
  const reducedMotion = useReducedMotion();
  const items = intensity === 'quiet' ? FLOATERS.slice(0, 4) : FLOATERS;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 400 800" preserveAspectRatio="none">
        <Ellipse cx="330" cy="110" rx="150" ry="110" fill={COLORS.goldLight} opacity="0.55" />
        <Ellipse cx="40" cy="420" rx="130" ry="160" fill={COLORS.primaryLight} opacity="0.5" />
        <Path d="M0 640c80-40 150-20 220 10s120 30 180-6v156H0Z" fill={COLORS.creamDeep} opacity="0.5" />
      </Svg>
      {items.map((item, index) => <Floater key={`${item.kind}-${index}`} item={item} reducedMotion={reducedMotion} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  floater: { position: 'absolute' },
});
