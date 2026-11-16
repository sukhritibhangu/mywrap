import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UtensilsCrossed } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import Button from './Button';

const EmptyState = ({ title = 'No items found', message = 'Try searching for something else or explore categories.', buttonTitle, onButtonPress }) => {
  return (
    <View style={styles.container} accessibilityRole="summary">
      <View style={styles.iconCircle}>
        <UtensilsCrossed size={40} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {buttonTitle && onButtonPress && (
        <Button title={buttonTitle} onPress={onButtonPress} style={styles.button} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 28,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 24,
  },
});

export default EmptyState;
