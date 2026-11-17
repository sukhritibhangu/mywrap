import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const SearchBar = ({ value, onChangeText, onClear, placeholder = 'Search wraps, burgers and more', style }) => {
  return (
    <View style={[styles.container, style]}>
      <Search size={19} color={COLORS.cocoaSoft} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.cocoaMuted}
        style={styles.input}
        accessibilityLabel="Search the menu"
        accessibilityRole="search"
        returnKeyType="search"
      />
      {value ? (
        <TouchableOpacity onPress={onClear} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear search">
          <X size={17} color={COLORS.cocoaSoft} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 52,
    backgroundColor: COLORS.cardBackground,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginVertical: 10,
    ...THEME.shadow.soft,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 0 },
  clearBtn: { padding: 8, minWidth: 34, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
});

export default SearchBar;
