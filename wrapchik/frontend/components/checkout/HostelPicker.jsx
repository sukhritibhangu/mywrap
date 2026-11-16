import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import COLORS from '../../constants/colors';

const HOSTELS = [
  'Hostel A', 'Hostel B', 'Hostel C', 'Hostel D', 'Hostel E', 'Hostel F', 'Hostel G', 
  'Hostel H', 'Hostel I', 'Hostel J', 'Hostel K', 'Hostel L', 'Hostel M', 'Hostel N', 
  'Hostel O', 'PG Hostel', 'International Hostel'
];

const HostelPicker = ({ selectedHostel, onSelectHostel }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select Hostel</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {HOSTELS.map((hostel) => {
          const isSelected = selectedHostel === hostel;
          return (
            <TouchableOpacity
              key={hostel}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onSelectHostel(hostel)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={hostel}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {hostel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  scrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  chipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

export default HostelPicker;
