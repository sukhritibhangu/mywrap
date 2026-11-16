import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import COLORS from '../../constants/colors';

const TableSelector = ({ tables, selectedTableId, onSelectTable, loading }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading tables...</Text>
      </View>
    );
  }

  if (!tables || tables.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No tables available at the moment.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select a Table</Text>
      <View style={styles.grid}>
        {tables.map((table) => {
          const isAvailable = table.status === 'AVAILABLE';
          const isSelected = selectedTableId === table._id;
          
          return (
            <TouchableOpacity
              key={table._id}
              style={[
                styles.tableCard,
                isSelected && styles.tableCardSelected,
                !isAvailable && styles.tableCardDisabled
              ]}
              onPress={() => isAvailable && onSelectTable(table._id)}
              disabled={!isAvailable}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: !isAvailable }}
              accessibilityLabel={`Table ${table.tableNumber}, ${table.capacity} seats, ${table.status.toLowerCase()}`}
            >
              <Text style={[styles.tableNum, isSelected && styles.textSelected, !isAvailable && styles.textDisabled]}>
                Table {table.tableNumber}
              </Text>
              <Text style={[styles.capacity, isSelected && styles.textSelected, !isAvailable && styles.textDisabled]}>
                {table.capacity} Seats
              </Text>
              <View style={[styles.badge, isAvailable ? styles.badgeAvailable : styles.badgeOccupied]}>
                <Text style={[styles.badgeText, isAvailable ? styles.badgeTextAvailable : styles.badgeTextOccupied]}>
                  {table.status}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
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
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tableCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  tableCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  tableCardDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: COLORS.border,
  },
  tableNum: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  capacity: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  textSelected: {
    color: COLORS.primary,
  },
  textDisabled: {
    color: '#9CA3AF',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAvailable: {
    backgroundColor: COLORS.successLight,
  },
  badgeOccupied: {
    backgroundColor: COLORS.dangerLight,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextAvailable: {
    color: COLORS.success,
  },
  badgeTextOccupied: {
    color: COLORS.danger,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});

export default TableSelector;
