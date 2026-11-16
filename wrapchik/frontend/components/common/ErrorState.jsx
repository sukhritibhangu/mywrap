import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import Button from './Button';

export default function ErrorState({ title = 'Could not load the menu', message = 'Check your connection and try again.', onRetry, retrying = false }) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.icon}><WifiOff size={24} color={COLORS.danger} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} loading={retrying} variant="outline" style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginVertical: 16, padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.dangerLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, maxWidth: 340 },
  button: { marginTop: 16, minWidth: 140 },
});
