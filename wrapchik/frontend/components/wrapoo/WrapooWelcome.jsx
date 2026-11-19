import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RotateCcw, Sparkles, Volume2, Square } from 'lucide-react-native';
import Wrapoo from './Wrapoo';
import { useCompanion } from '../../context/CompanionContext';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const DEFAULT_MESSAGE = "Hi, I'm Rapo! Your foodie buddy! Tap my hat whenever you need a little help!";

const HAT_SURPRISES = [
  'You found my secret sprinkle stash! ✨',
  'Psst… the cheese pull is real today.',
  'My hat? It keeps the magic warm.',
  'Wohoo! Free high-five, campus legend.',
];

/**
 * Rapo's inline chat card. It lives inside page content so it never covers
 * navigation, prices or checkout actions. Tapping Rapo (or the bubble) has him
 * read the message aloud where the browser supports speech.
 */
export default function WrapooWelcome({ title = 'Rapo says', message, compact = false, style }) {
  const { speaking, speechSupported, speak, stopSpeaking } = useCompanion();
  const reducedMotion = useReducedMotion();
  const [surprise, setSurprise] = useState(null);
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  const greeting = useMemo(() => message || DEFAULT_MESSAGE, [message]);
  const shownText = surprise || greeting;

  useEffect(() => {
    if (reducedMotion) { entrance.setValue(1); return undefined; }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [entrance, reducedMotion]);

  const saySurprise = useCallback(() => {
    const next = HAT_SURPRISES[Math.floor(Math.random() * HAT_SURPRISES.length)];
    setSurprise(next);
    speak(next, { mood: 'celebrating' });
  }, [speak]);

  const speakCurrent = useCallback(() => {
    speak(shownText, { mood: 'talking' });
  }, [shownText, speak]);

  const replay = useCallback(() => {
    setSurprise(null);
    speak(greeting, { mood: 'talking' });
  }, [greeting, speak]);

  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Animated.View style={[styles.card, compact && styles.cardCompact, style, { opacity: entrance, transform: [{ translateY }] }]}>
      <View style={styles.illustration}>
        <Wrapoo
          size={compact ? 64 : 82}
          mood={speaking ? 'talking' : surprise ? 'celebrating' : 'happy'}
          onPress={speakCurrent}
          onPressHat={saySurprise}
        />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.kicker}>{title.toUpperCase()}</Text>
          <Sparkles size={12} color={COLORS.gold} />
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={speakCurrent}
          accessibilityRole="button"
          accessibilityLabel={`Rapo says: ${shownText}. Tap to hear it.`}
          style={styles.bubble}
        >
          <Text style={styles.message}>{shownText}</Text>
        </TouchableOpacity>

        {speechSupported ? (
          <View style={styles.controls}>
            <TouchableOpacity
              onPress={replay}
              style={styles.control}
              accessibilityRole="button"
              accessibilityLabel="Hear Rapo again"
            >
              <RotateCcw size={13} color={COLORS.cocoaSoft} />
              <Text style={styles.controlText}>Say it again</Text>
            </TouchableOpacity>
            {speaking ? (
              <>
                <View style={styles.controlDivider} />
                <TouchableOpacity
                  onPress={stopSpeaking}
                  style={styles.control}
                  accessibilityRole="button"
                  accessibilityLabel="Stop Rapo speaking"
                >
                  <Square size={12} color={COLORS.cocoaSoft} />
                  <Text style={styles.controlText}>Stop</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.controlDivider} />
                <View style={styles.control}>
                  <Volume2 size={13} color={COLORS.cocoaMuted} />
                  <Text style={styles.hintText}>Tap me to hear it</Text>
                </View>
              </>
            )}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: THEME.layout.pageGutter,
    marginTop: 16,
    paddingVertical: 12,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: THEME.radius.lg,
    backgroundColor: COLORS.parchment,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...THEME.shadow.soft,
  },
  cardCompact: { marginTop: 10, paddingVertical: 8 },
  illustration: { width: 88, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 6 },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3, color: COLORS.goldDeep },
  bubble: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    borderTopLeftRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(242,96,31,0.16)',
  },
  message: { fontSize: 13, lineHeight: 19, color: COLORS.cocoa, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  control: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 30 },
  controlText: { fontSize: 11, fontWeight: '800', color: COLORS.cocoaSoft },
  hintText: { fontSize: 11, fontWeight: '600', color: COLORS.cocoaMuted },
  controlDivider: { width: 1, height: 14, backgroundColor: COLORS.border },
});
