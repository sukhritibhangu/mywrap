import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import COLORS from '../../constants/colors';

const SearchBar = ({ value, onChangeText, onClear, placeholder = 'Search wraps, burgers and more', style }) => {
  return (
    <View style={[styles.container, style]}>
      <Search size={20} color={COLORS.textSecondary} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        style={styles.input}
        accessibilityLabel="Search the menu"
        accessibilityRole="search"
        returnKeyType="search"
      />
      {value ? (
        <TouchableOpacity onPress={onClear} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear search">
          <X size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  clearBtn: {
    padding: 4,
  },
});

export default SearchBar;
