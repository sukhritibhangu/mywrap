import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Wrapoo from './Wrapoo';
import { useCompanion } from '../../context/CompanionContext';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

/**
 * A short, dismissible celebration that appears below the header. It never
 * covers the tab bar, checkout actions or the payment QR.
 */
export default function WrapooToast() {
  const { message, dismiss } = useCompanion();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) { progress.setValue(0); return; }
    if (reducedMotion) { progress.setValue(1); return; }
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [message, progress, reducedMotion]);

  if (!message) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] });
  const opacity = progress;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.layer, { opacity, transform: [{ translateY }] }]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={`${message.text}. Tap to dismiss.`}
        accessibilityLiveRegion="polite"
        style={styles.toast}
      >
        <Wrapoo size={48} mood={message.mood || 'cheer'} floating={false} />
        <View style={styles.copy}>
          <Text style={styles.kicker}>WRAPOO</Text>
          <Text style={styles.text} numberOfLines={3}>{message.text}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingLeft: 6,
    paddingRight: 16,
    maxWidth: 380,
    borderRadius: THEME.radius.pill,
    backgroundColor: COLORS.parchment,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    ...THEME.shadow.gold,
  },
  copy: { flexShrink: 1, paddingVertical: 4 },
  kicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.4, color: COLORS.goldDeep },
  text: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: COLORS.cocoa, marginTop: 1 },
});
