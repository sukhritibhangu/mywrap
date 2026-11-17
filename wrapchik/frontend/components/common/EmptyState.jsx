import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';
import Button from './Button';
import Wrapoo from '../wrapoo/Wrapoo';

const EmptyState = ({ title = 'No items found', message = 'Try searching for something else or explore categories.', buttonTitle, onButtonPress, showWrapoo = true }) => {
  return (
    <View style={styles.container} accessibilityRole="summary">
      <View style={styles.iconCircle}>
        {showWrapoo
          ? <Wrapoo size={72} mood="sleepy" />
          : <Sparkles size={32} color={COLORS.gold} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {buttonTitle && onButtonPress ? (
        <Button title={buttonTitle} onPress={onButtonPress} style={styles.button} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 26,
    borderRadius: THEME.radius.xl,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadow.soft,
  },
  iconCircle: {
    minHeight: 84,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 7, textAlign: 'center' },
  message: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 18, maxWidth: 340 },
  button: { paddingHorizontal: 26, minWidth: 160 },
});

export default EmptyState;
