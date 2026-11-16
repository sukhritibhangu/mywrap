import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import COLORS from '../../constants/colors';

const LoadingIndicator = ({ message = 'Loading...', compact = false }) => {
  return (
    <View style={[styles.container, compact && styles.compact]} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size={compact ? 'small' : 'large'} color={COLORS.primary} />
      <Text style={[styles.text, compact && styles.compactText]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    minHeight: 180,
  },
  compact: {
    minHeight: 64,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  text: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  compactText: {
    marginTop: 0,
  },
});

export default LoadingIndicator;
