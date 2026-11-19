import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ShoppingBag, Sparkles } from 'lucide-react-native';
import useReducedMotion from '../hooks/useReducedMotion';
import COLORS from '../constants/colors';

export const FlyToCartContext = createContext({ flyToCart: () => {}, landCount: 0, setCartTarget: () => {} });

export const useFlyToCart = () => useContext(FlyToCartContext);

const CHIP = 52;
const TRAVEL_MS = 1000;

function Flight({ flight, target, onDone, onLand }) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  const start = flight.start || { x: width / 2 - CHIP / 2, y: height * 0.55, w: 0, h: 0 };
  const fromX = start.x + (start.w || 0) / 2 - CHIP / 2;
  const fromY = start.y + (start.h || 0) / 2 - CHIP / 2;

  // Aim at the measured header cart when it is available, otherwise fall back
  // to the header's top-right corner (where the cart lives on every layout).
  const fallbackX = width - 40 - CHIP / 2;
  const fallbackY = 34 - CHIP / 2;
  const toX = target ? target.x + target.w / 2 - CHIP / 2 : fallbackX;
  const toY = target ? target.y + target.h / 2 - CHIP / 2 : fallbackY;
  const landX = target ? target.x + target.w / 2 : width - 40;
  const landY = target ? target.y + target.h / 2 : 34;

  const peak = Math.min(fromY, toY) - Math.max(90, Math.abs(fromY - toY) * 0.3);
  const sway = Math.sign(toX - fromX || 1) * Math.min(70, Math.abs(toX - fromX) * 0.18);

  useEffect(() => {
    if (reducedMotion) {
      onLand();
      const timer = setTimeout(onDone, 0);
      return () => clearTimeout(timer);
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: TRAVEL_MS,
      easing: Easing.bezier(0.22, 0.68, 0.26, 1),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      onLand();
      Animated.timing(burst, {
        toValue: 1, duration: 400, easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      setTimeout(onDone, 420);
    });
    return () => animation.stop();
  }, [burst, onDone, onLand, progress, reducedMotion]);

  const translateX = progress.interpolate({
    inputRange: [0, 0.42, 0.78, 1],
    outputRange: [0, (toX - fromX) * 0.55 + sway, (toX - fromX) * 0.9 + sway * 0.3, toX - fromX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, peak - fromY, toY - fromY],
  });
  const scale = progress.interpolate({ inputRange: [0, 0.15, 0.72, 1], outputRange: [0.92, 1.18, 0.78, 0.34] });
  const rotate = progress.interpolate({ inputRange: [0, 0.45, 1], outputRange: ['-12deg', '14deg', '0deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.35, 2.2] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.chip, { left: fromX, top: fromY, opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate }] }]}>
        {flight.imageUrl
          ? <Image source={{ uri: flight.imageUrl }} style={styles.image} resizeMode="cover" />
          : <ShoppingBag size={22} color={COLORS.primaryDark} />}
        <View style={styles.spark}><Sparkles size={12} color={COLORS.goldDeep} /></View>
      </Animated.View>

      <Animated.View
        style={[
          styles.landBurst,
          { left: landX, top: landY, opacity: burstOpacity, transform: [{ scale: burstScale }] },
        ]}
      >
        <View style={styles.burstRing} />
      </Animated.View>
    </View>
  );
}

/**
 * One shared overlay for the "food flies into the bag" moment. A source card
 * measures itself, then the chip arcs to the measured header cart and the cart
 * bounces. Rapid taps stack their own flights without dropping any.
 */
export const FlyToCartProvider = ({ children }) => {
  const [flights, setFlights] = useState([]);
  const [landCount, setLandCount] = useState(0);
  const [cartTarget, setCartTarget] = useState(null);
  const idRef = useRef(0);

  const flyToCart = useCallback(({ imageUrl, start }) => {
    idRef.current += 1;
    const id = idRef.current;
    // Keep at most three chips in the air so repeated taps stay readable.
    setFlights((current) => [...current.slice(-2), { id, imageUrl, start }]);
  }, []);

  const finish = useCallback((id) => {
    setFlights((current) => current.filter((flight) => flight.id !== id));
  }, []);

  const land = useCallback(() => setLandCount((count) => count + 1), []);

  const registerTarget = useCallback((rect) => {
    if (!rect) return;
    setCartTarget((current) => {
      if (current && current.x === rect.x && current.y === rect.y && current.w === rect.w && current.h === rect.h) return current;
      return rect;
    });
  }, []);

  return (
    <FlyToCartContext.Provider value={{ flyToCart, landCount, setCartTarget: registerTarget }}>
      {children}
      {flights.map((flight) => (
        <Flight
          key={flight.id}
          flight={flight}
          target={cartTarget}
          onLand={land}
          onDone={() => finish(flight.id)}
        />
      ))}
    </FlyToCartContext.Provider>
  );
};

const styles = StyleSheet.create({
  layer: { zIndex: 999 },
  chip: {
    position: 'absolute', width: CHIP, height: CHIP, borderRadius: 16,
    backgroundColor: COLORS.cardBackground, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.gold, overflow: 'visible',
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 9,
  },
  image: { width: CHIP - 4, height: CHIP - 4, borderRadius: 14 },
  spark: {
    position: 'absolute', right: -8, top: -8, width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.goldLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.gold,
  },
  landBurst: { position: 'absolute', width: 2, height: 2, marginLeft: -1, marginTop: -1, alignItems: 'center', justifyContent: 'center' },
  burstRing: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: COLORS.gold },
});
