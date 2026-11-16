import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Truck, ShoppingBag, UtensilsCrossed, Check } from 'lucide-react-native';
import COLORS from '../../constants/colors';

const FulfillmentSelector = ({ selectedMode, onSelectMode, settings }) => {
  const modes = [
    { id: 'TAKEAWAY', title: 'Pickup', desc: 'SAC counter', icon: ShoppingBag, enabled: settings?.takeawayEnabled === true },
    { id: 'DELIVERY', title: 'Delivery', desc: 'Hostel', icon: Truck, enabled: settings?.deliveryEnabled === true },
    { id: 'DINE_IN', title: 'Dine in', desc: 'At table', icon: UtensilsCrossed, enabled: settings?.dineInEnabled === true },
  ];
  const enabledModes = modes.filter((mode) => mode.enabled);

  return (
    <View style={styles.container}>
      {enabledModes.length === 0 ? <Text style={styles.emptyText}>The outlet has not enabled a fulfillment option. Please try again later.</Text> : null}
      {enabledModes.map((mode) => {
        const Icon = mode.icon;
        const selected = selectedMode === mode.id;
        const disabled = !mode.enabled;
        return (
          <TouchableOpacity
            key={mode.id}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${mode.title}: ${disabled ? 'unavailable' : mode.desc}`}
            onPress={() => onSelectMode(mode.id)}
            activeOpacity={0.86}
            style={[styles.card, selected && styles.selected, disabled && styles.disabled]}
          >
            {selected && <View style={styles.check}><Check size={11} color="#FFF" strokeWidth={3} /></View>}
            <View style={[styles.iconBox, selected && styles.iconSelected]}>
              <Icon size={23} color={disabled ? '#A5A5A5' : selected ? COLORS.primary : COLORS.textPrimary} />
            </View>
            <Text style={[styles.title, selected && styles.titleSelected, disabled && styles.disabledText]}>{mode.title}</Text>
            <Text style={[styles.desc, disabled && styles.disabledText]}>{disabled ? 'Unavailable' : mode.desc}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 9 },
  card: { flex: 1, minHeight: 118, backgroundColor: '#FFF', borderRadius: 18, padding: 12, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  selected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  disabled: { backgroundColor: '#F4F4F4', borderColor: '#E5E5E5' },
  iconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.inputBackground, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  iconSelected: { backgroundColor: '#FFF' },
  title: { fontSize: 13, fontWeight: '900', color: COLORS.textPrimary },
  titleSelected: { color: COLORS.primary },
  desc: { fontSize: 10, color: COLORS.textSecondary, marginTop: 3 },
  disabledText: { color: '#A5A5A5' },
  check: { position: 'absolute', right: 7, top: 7, width: 19, height: 19, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  emptyText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
});

export default FulfillmentSelector;
