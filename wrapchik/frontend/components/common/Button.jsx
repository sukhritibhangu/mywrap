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
      activeOpacity={0.8}
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
        <ActivityIndicator color={isOutline ? COLORS.primary : '#FFFFFF'} size="small" />
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
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  btnSecondary: {
    backgroundColor: COLORS.primaryLight,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  btnDanger: {
    backgroundColor: COLORS.danger,
  },
  btnDisabled: {
    backgroundColor: '#E9E7E4',
    borderColor: '#E9E7E4',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: COLORS.primary,
  },
  textOutline: {
    color: COLORS.primary,
  },
  textDanger: {
    color: '#FFFFFF',
  },
  textDisabled: {
    color: '#9E9E9E',
  },
});

export default Button;
