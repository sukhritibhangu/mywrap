import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';

const PALETTE = [COLORS.primary, COLORS.gold, COLORS.secondary, '#F6B39C', COLORS.creamDeep, COLORS.success];

function Piece({ index, width, height, reducedMotion }) {
  const progress = useRef(new Animated.Value(0)).current;
  const specs = useMemo(() => {
    const seeded = (n) => {
      const value = Math.sin(index * 12.9898 + n * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };
    return {
      startX: seeded(1) * width,
      startY: -20 - seeded(2) * 30,
      drift: (seeded(3) - 0.5) * width * 0.55,
      fall: height * (0.65 + seeded(4) * 0.35),
      rotations: 2 + Math.floor(seeded(5) * 4),
      delay: Math.floor(seeded(6) * 260),
      color: PALETTE[index % PALETTE.length],
      circle: seeded(7) > 0.62,
      size: 7 + Math.floor(seeded(8) * 7),
    };
  }, [height, index, width]);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1700 + (index % 5) * 140,
      delay: specs.delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reducedMotion, specs.delay]);

  if (reducedMotion) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [specs.startY, specs.startY + specs.fall] });
  const translateX = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [specs.startX, specs.startX + specs.drift, specs.startX + specs.drift * 0.3] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${specs.rotations * 180}deg`] });
  const opacity = progress.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View pointerEvents="none" style={[styles.piece, { transform: [{ translateX }, { translateY }, { rotate }], opacity }]}>
      <Svg width={specs.size} height={specs.size} viewBox="0 0 12 12">
        {specs.circle
          ? <Circle cx="6" cy="6" r="5" fill={specs.color} />
          : <Rect x="1" y="2" width="10" height="7" rx="2" fill={specs.color} transform="rotate(18 6 6)" />}
      </Svg>
    </Animated.View>
  );
}

/**
 * A short, joyful burst for a completed order. Renders above content but is
 * pointer-transparent and disappears on its own.
 */
export default function Confetti({ active = true, pieces = 26 }) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  if (!active || reducedMotion) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: pieces }, (_, index) => (
        <Piece key={index} index={index} width={width} height={height} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { overflow: 'hidden', zIndex: 40 },
  piece: { position: 'absolute', top: 0, left: 0 },
});
