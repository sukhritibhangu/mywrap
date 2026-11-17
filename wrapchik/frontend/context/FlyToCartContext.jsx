import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ShoppingBag, Sparkles } from 'lucide-react-native';
import useReducedMotion from '../hooks/useReducedMotion';
import COLORS from '../constants/colors';

export const FlyToCartContext = createContext({ flyToCart: () => {}, landCount: 0 });

export const useFlyToCart = () => useContext(FlyToCartContext);

const CHIP = 44;

function Flight({ flight, onDone, onLand }) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  const start = flight.start || { x: width / 2 - CHIP / 2, y: height * 0.55, w: 0, h: 0 };
  const fromX = start.x + (start.w || 0) / 2 - CHIP / 2;
  const fromY = start.y + (start.h || 0) / 2 - CHIP / 2;
  const toX = width - 40 - CHIP / 2;
  const toY = 34 - CHIP / 2;
  const peak = Math.min(fromY, toY) - Math.max(80, Math.abs(fromY - toY) * 0.28);

  useEffect(() => {
    if (reducedMotion) {
      onLand();
      const timer = setTimeout(onDone, 0);
      return () => clearTimeout(timer);
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 720,
      easing: Easing.bezier(0.28, 0.72, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      onLand();
      Animated.timing(burst, {
        toValue: 1, duration: 380, easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      setTimeout(onDone, 400);
    });
    return () => animation.stop();
  }, [burst, onDone, onLand, progress, reducedMotion]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, toX - fromX] });
  const translateY = progress.interpolate({
    inputRange: [0, 0.48, 1],
    outputRange: [0, peak - fromY, toY - fromY],
  });
  const scale = progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 1.12, 0.3] });
  const rotate = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-10deg', '16deg', '0deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 0.82, 1], outputRange: [1, 1, 0] });
  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.35, 2.1] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.chip, { left: fromX, top: fromY, opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate }] }]}>
        {flight.imageUrl
          ? <Image source={{ uri: flight.imageUrl }} style={styles.image} resizeMode="cover" />
          : <ShoppingBag size={20} color={COLORS.primaryDark} />}
        <View style={styles.spark}><Sparkles size={11} color={COLORS.goldDeep} /></View>
      </Animated.View>

      <Animated.View
        style={[
          styles.landBurst,
          { left: width - 42, top: 34, opacity: burstOpacity, transform: [{ scale: burstScale }] },
        ]}
      >
        <View style={styles.burstRing} />
      </Animated.View>
    </View>
  );
}

/**
 * One shared overlay for the "food flies into the bag" moment. A source card
 * measures itself, then the chip arcs to the header cart and the cart bounces.
 */
export const FlyToCartProvider = ({ children }) => {
  const [flight, setFlight] = useState(null);
  const [landCount, setLandCount] = useState(0);
  const idRef = useRef(0);

  const flyToCart = useCallback(({ imageUrl, start }) => {
    idRef.current += 1;
    setFlight({ id: idRef.current, imageUrl, start });
  }, []);

  return (
    <FlyToCartContext.Provider value={{ flyToCart, landCount }}>
      {children}
      {flight ? (
        <Flight
          key={flight.id}
          flight={flight}
          onLand={() => setLandCount((count) => count + 1)}
          onDone={() => setFlight(null)}
        />
      ) : null}
    </FlyToCartContext.Provider>
  );
};

const styles = StyleSheet.create({
  layer: { zIndex: 999 },
  chip: {
    position: 'absolute', width: CHIP, height: CHIP, borderRadius: 14,
    backgroundColor: COLORS.cardBackground, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.gold, overflow: 'visible',
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  image: { width: CHIP - 4, height: CHIP - 4, borderRadius: 12 },
  spark: {
    position: 'absolute', right: -7, top: -7, width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.goldLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.gold,
  },
  landBurst: { position: 'absolute', width: 2, height: 2, alignItems: 'center', justifyContent: 'center' },
  burstRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderColor: COLORS.gold },
});
