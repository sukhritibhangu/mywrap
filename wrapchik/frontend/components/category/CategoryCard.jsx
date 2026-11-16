import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { UtensilsCrossed } from 'lucide-react-native';
import COLORS from '../../constants/colors';

const CategoryCard = ({ category, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Show ${category.name} products`}
      style={[styles.card, isSelected && styles.cardSelected]}
    >
      <View style={[styles.imageContainer, isSelected && styles.imageSelected]}>
        {category.imageUrl ? <Image source={{ uri: category.imageUrl }} style={styles.image} resizeMode="cover" /> : <UtensilsCrossed size={23} color={isSelected ? COLORS.primary : COLORS.textSecondary} />}
      </View>
      <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    marginRight: 12,
    width: 78,
  },
  cardSelected: {
    transform: [{ scale: 1.05 }],
  },
  imageContainer: {
    width: 68,
    height: 68,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  nameSelected: {
    fontWeight: '800',
    color: COLORS.primary,
  },
});

export default CategoryCard;
