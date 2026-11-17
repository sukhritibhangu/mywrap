import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const Button = ({ title, onPress, variant = 'primary', loading = false, disabled = false, style, textStyle, accessibilityLabel, testID }) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      activeOpacity={0.85}
      style={[
        styles.button,
        isPrimary && styles.btnPrimary,
        isSecondary && styles.btnSecondary,
        isOutline && styles.btnOutline,
        isDanger && styles.btnDanger,
        disabled && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline || isSecondary ? COLORS.primary : '#FFFFFF'} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            isPrimary && styles.textPrimary,
            isSecondary && styles.textSecondary,
            isOutline && styles.textOutline,
            isDanger && styles.textDanger,
            disabled && styles.textDisabled,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: THEME.layout.touchTarget,
    borderRadius: THEME.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  btnSecondary: { backgroundColor: COLORS.goldLight, borderColor: COLORS.goldLight },
  btnOutline: { backgroundColor: 'transparent', borderColor: COLORS.primary },
  btnDanger: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  btnDisabled: { backgroundColor: COLORS.surfaceMuted, borderColor: COLORS.surfaceMuted, shadowOpacity: 0, elevation: 0 },
  text: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  textPrimary: { color: '#FFFFFF' },
  textSecondary: { color: COLORS.cocoa },
  textOutline: { color: COLORS.primaryDark },
  textDanger: { color: '#FFFFFF' },
  textDisabled: { color: '#A79A8C' },
});

export default Button;
