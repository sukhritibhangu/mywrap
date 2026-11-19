import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import Wrapoo from '../components/wrapoo/Wrapoo';
import { AuthContext } from '../context/AuthContext';
import useReducedMotion from '../hooks/useReducedMotion';
import COLORS from '../constants/colors';

const SESSION_KEY = 'wrapchik_splash_seen';
let seenThisLaunch = false;

/** The opening sequence is once per browser session, never on every refresh. */
function hasSeenSplash() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return window.sessionStorage?.getItem(SESSION_KEY) === '1' || seenThisLaunch;
    } catch (error) {
      return seenThisLaunch;
    }
  }
  return seenThisLaunch;
}

function markSplashSeen() {
  seenThisLaunch = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.sessionStorage?.setItem(SESSION_KEY, '1');
    } catch (error) {
      // Private browsing can refuse storage; the in-memory flag still works.
    }
  }
}

const FOOD = [
  { key: 'wrap', emoji: '🌯', left: '8%', top: '20%', drift: 26, delay: 60, size: 38 },
  { key: 'burger', emoji: '🍔', left: '76%', top: '16%', drift: -22, delay: 180, size: 34 },
  { key: 'fries', emoji: '🍟', left: '14%', top: '68%', drift: -30, delay: 120, size: 32 },
  { key: 'pizza', emoji: '🍕', left: '80%', top: '64%', drift: 24, delay: 240, size: 36 },
  { key: 'drink', emoji: '🥤', left: '6%', top: '44%', drift: 18, delay: 320, size: 28 },
  { key: 'sandwich', emoji: '🥪', left: '84%', top: '40%', drift: -18, delay: 380, size: 28 },
];

function FloatingFood({ item, exit, reducedMotion }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1700 + item.delay, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(float, { toValue: 0, duration: 1700 + item.delay, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), item.delay);
    return () => { clearTimeout(timer); loop.stop(); };
  }, [float, item.delay, reducedMotion]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const rotate = float.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] });
  const drift = exit.interpolate({ inputRange: [0, 1], outputRange: [0, item.drift * 3] });
  const exitOpacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const exitScale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.food,
        { left: item.left, top: item.top, opacity: exitOpacity, transform: [{ translateY }, { translateX: drift }, { rotate }, { scale: exitScale }] },
      ]}
    >
      <Text style={{ fontSize: item.size }}>{item.emoji}</Text>
    </Animated.View>
  );
}

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useContext(AuthContext);
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const [scene, setScene] = useState(1);
  const reveal = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const brandSettle = useRef(new Animated.Value(1)).current;
  const navigated = useRef(false);

  const destination = useMemo(() => {
    if (isAuthenticated && user) {
      return user.role === 'admin' ? '/admin/dashboard' : '/(tabs)/home';
    }
    return '/(auth)/login';
  }, [isAuthenticated, user]);

  const leave = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    markSplashSeen();
    router.replace(destination);
  }, [destination, router]);

  // The opening sequence skips itself for the rest of this browser session.
  useEffect(() => {
    if (!hasSeenSplash()) return;
    if (isLoading) return;
    leave();
  }, [isLoading, leave]);

  useEffect(() => {
    if (reducedMotion) { reveal.setValue(1); return undefined; }
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: 780,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [reveal, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const sceneTwo = setTimeout(() => setScene(2), 520);
    const sceneThree = setTimeout(() => {
      setScene(3);
      Animated.timing(brandSettle, { toValue: 0.82, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
      Animated.timing(exit, { toValue: 1, duration: 560, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
    }, 2150);
    return () => { clearTimeout(sceneTwo); clearTimeout(sceneThree); };
  }, [brandSettle, exit, reducedMotion]);

  // Reduced motion keeps the screen calm and short, but still informative.
  useEffect(() => {
    if (!reducedMotion) return undefined;
    const timer = setTimeout(leave, 900);
    return () => clearTimeout(timer);
  }, [leave, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || hasSeenSplash()) return undefined;
    const finish = setTimeout(leave, 2900);
    return () => clearTimeout(finish);
  }, [leave, reducedMotion]);

  const logoOpacity = reveal;
  const logoScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const titleOpacity = reveal.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0, 1] });
  const titleShift = reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const scaleOut = Animated.multiply(logoScale, brandSettle);

  if (hasSeenSplash()) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <BackgroundGlow width={width} />

      {scene >= 2 || reducedMotion ? FOOD.map((item) => (
        <FloatingFood key={item.key} item={item} exit={exit} reducedMotion={reducedMotion} />
      )) : null}

      <Animated.View style={[styles.brand, { opacity: logoOpacity, transform: [{ scale: scaleOut }] }]}>
        <View style={styles.logoCircle}>
          <Wrapoo size={96} mood={scene >= 2 ? 'celebrating' : 'happy'} floating={!reducedMotion} />
        </View>
        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleShift }] }}>
          <Text style={styles.brandTitle}>WRAPCHIK</Text>
          <View style={styles.taglineRow}>
            <Sparkles size={12} color={COLORS.gold} />
            <Text style={styles.tagline}>Fresh wraps, happy bites</Text>
            <Sparkles size={12} color={COLORS.gold} />
          </View>
        </Animated.View>
      </Animated.View>

      <TouchableOpacity onPress={leave} style={styles.skip} accessibilityRole="button" accessibilityLabel="Skip the opening animation">
        <Text style={styles.skipText}>Skip</Text>
        <ChevronRight size={15} color={COLORS.cocoaSoft} />
      </TouchableOpacity>
    </View>
  );
}

function BackgroundGlow({ width }) {
  const glow = Math.min(420, width * 0.9);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.washTop} />
      <View style={styles.washBottom} />
      <View style={[styles.glow, { width: glow, height: glow, borderRadius: glow / 2, left: -glow * 0.25, top: -glow * 0.15 }]} />
      <View style={[styles.glow, styles.glowGold, { width: glow * 0.8, height: glow * 0.8, borderRadius: glow * 0.4, right: -glow * 0.2, bottom: -glow * 0.1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  washTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFEBDA',
    opacity: 0.7,
  },
  washBottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%',
    backgroundColor: '#FDF3E2', opacity: 0.85,
  },
  glow: {
    position: 'absolute', backgroundColor: '#FFD9BE', opacity: 0.55,
  },
  glowGold: { backgroundColor: '#FBE7BE', opacity: 0.7 },
  food: { position: 'absolute' },
  brand: { alignItems: 'center', paddingHorizontal: 24 },
  logoCircle: {
    width: 168, height: 168, borderRadius: 84,
    backgroundColor: 'rgba(255,253,248,0.92)',
    borderWidth: 2, borderColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    marginBottom: 22,
  },
  brandTitle: {
    fontSize: 34, fontWeight: '900', color: COLORS.primaryDark,
    letterSpacing: 5, textAlign: 'center',
  },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, justifyContent: 'center' },
  tagline: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4, color: COLORS.cocoaSoft },
  skip: {
    position: 'absolute', top: 18, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    minHeight: 44, paddingHorizontal: 14,
    borderRadius: 999, backgroundColor: 'rgba(255,253,248,0.85)',
    borderWidth: 1, borderColor: COLORS.border,
  },
  skipText: { fontSize: 12.5, fontWeight: '800', color: COLORS.cocoaSoft },
});
