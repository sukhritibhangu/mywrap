import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import useReducedMotion from '../../hooks/useReducedMotion';

/**
 * A quiet fade-and-rise used to introduce admin panels and list rows. Admin
 * motion stays short so it never slows down order handling:
 *
 * - rows remain tappable throughout; the animation is visual only
 * - the stagger delay is captured at mount, so a realtime refresh that reorders
 *   or prepends the queue never replays the entrance for rows already on screen
 * - the delay is capped by callers, keeping long lists settled within ~0.5s
 * - reduced-motion users get the final frame immediately
 */
export function AdminRevealRow({ children, delay = 0, style, reducedMotion = false }) {
  const initialDelay = useRef(delay).current;
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) { progress.setValue(1); return undefined; }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      delay: initialDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [initialDelay, progress, reducedMotion]);

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

/**
 * Panel-level reveal: reads the reduced-motion preference itself. Lists should
 * read it once at screen level and pass it to AdminRevealRow so a long queue
 * does not register one accessibility listener per row.
 */
export default function AdminReveal({ reducedMotion, ...props }) {
  const systemReducedMotion = useReducedMotion();
  return <AdminRevealRow {...props} reducedMotion={reducedMotion ?? systemReducedMotion} />;
}
