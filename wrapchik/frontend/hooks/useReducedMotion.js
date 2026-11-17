import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Tracks the platform "reduce motion" preference so decorative animation can
 * settle into a calm, static presentation. Defaults to false while the value
 * loads; decorative motion is never required to understand the app.
 */
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    let subscription;
    let mediaQuery;
    let mediaQueryListener;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => { if (active) setReduced(Boolean(value)); })
      .catch(() => {});

    try {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
        if (active) setReduced(Boolean(value));
      });
    } catch (error) {
      subscription = null;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      mediaQueryListener = (event) => { if (active) setReduced(Boolean(event.matches)); };
      setReduced(Boolean(mediaQuery.matches));
      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', mediaQueryListener);
      else if (mediaQuery.addListener) mediaQuery.addListener(mediaQueryListener);
    }

    return () => {
      active = false;
      subscription?.remove?.();
      if (mediaQuery && mediaQueryListener) {
        if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', mediaQueryListener);
        else if (mediaQuery.removeListener) mediaQuery.removeListener(mediaQueryListener);
      }
    };
  }, []);

  return reduced;
}
