import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import useReducedMotion from '../../hooks/useReducedMotion';

/**
 * A quiet fade-and-rise used to introduce admin panels. Admin motion stays
 * short and functional so it never slows down order handling.
 */
export default function AdminReveal({ children, delay = 0, style }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) { progress.setValue(1); return undefined; }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reducedMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
