import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { VolumeX, Volume2, EyeOff, Eye, Sparkles } from 'lucide-react-native';
import Wrapoo from './Wrapoo';
import { useCompanion } from '../../context/CompanionContext';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const HAT_SURPRISES = [
  'You found my secret sprinkle stash! ✨',
  'Psst… the cheese pull is real today.',
  'My hat? It keeps the magic warm.',
  'Wohoo! Free high-five, campus legend.',
];

/**
 * Inline welcome card for Wrapoo. Sits inside page content, never over
 * navigation, checkout actions or payment QR codes.
 */
export default function WrapooWelcome({ title = 'Wrapoo says', message, compact = false }) {
  const { hidden, quiet, toggleHidden, toggleQuiet } = useCompanion();
  const [surprise, setSurprise] = useState(null);
  const greeting = useMemo(() => message || 'Hi! I’m Wrapoo. Tap my hat if you’re curious, or let’s go find something delicious.', [message]);

  if (hidden) {
    return (
      <TouchableOpacity
        style={styles.restore}
        onPress={toggleHidden}
        accessibilityRole="button"
        accessibilityLabel="Bring Wrapoo back"
      >
        <Sparkles size={14} color={COLORS.goldDeep} />
        <Text style={styles.restoreText}>Bring Wrapoo back</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.illustration}>
        <Wrapoo
          size={compact ? 64 : 78}
          mood={surprise ? 'cheer' : 'happy'}
          onPressHat={() => setSurprise(HAT_SURPRISES[Math.floor(Math.random() * HAT_SURPRISES.length)])}
        />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.kicker}>{title.toUpperCase()}</Text>
          <Sparkles size={12} color={COLORS.gold} />
        </View>
        <Text style={styles.message}>{surprise || (quiet ? 'Wrapoo is keeping it quiet. Tap the sound button to hear little thoughts again.' : greeting)}</Text>
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={toggleQuiet}
            style={styles.control}
            accessibilityRole="button"
            accessibilityLabel={quiet ? 'Unmute Wrapoo chatter' : 'Mute Wrapoo chatter'}
          >
            {quiet ? <VolumeX size={15} color={COLORS.cocoaSoft} /> : <Volume2 size={15} color={COLORS.cocoaSoft} />}
            <Text style={styles.controlText}>{quiet ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            onPress={toggleHidden}
            style={styles.control}
            accessibilityRole="button"
            accessibilityLabel="Hide Wrapoo"
          >
            <EyeOff size={15} color={COLORS.cocoaSoft} />
            <Text style={styles.controlText}>Hide</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: THEME.layout.pageGutter,
    marginTop: 16,
    padding: 14,
    paddingRight: 16,
    borderRadius: THEME.radius.lg,
    backgroundColor: COLORS.parchment,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...THEME.shadow.soft,
  },
  cardCompact: { marginTop: 10, paddingVertical: 10 },
  illustration: { width: 82, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 8 },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3, color: COLORS.goldDeep },
  message: { fontSize: 13, lineHeight: 19, color: COLORS.cocoa, marginTop: 3, fontWeight: '500' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  control: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 30 },
  controlText: { fontSize: 11, fontWeight: '700', color: COLORS.cocoaSoft },
  controlDivider: { width: 1, height: 14, backgroundColor: COLORS.border },
  restore: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: THEME.layout.pageGutter,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radius.pill,
    backgroundColor: COLORS.goldLight,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  restoreText: { fontSize: 12, fontWeight: '800', color: COLORS.cocoa },
});
