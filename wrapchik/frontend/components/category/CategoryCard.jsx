import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { UtensilsCrossed } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';
import useReducedMotion from '../../hooks/useReducedMotion';

const CategoryCard = ({ category, isSelected, onPress }) => {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isSelected ? 1 : 0,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isSelected, progress]);

  const transform = reducedMotion
    ? []
    : [
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) },
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
      ];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Show ${category.name} products`}
      style={styles.card}
    >
      <Animated.View style={[styles.imageContainer, isSelected && styles.imageSelected, { transform }]}>
        {category.imageUrl
          ? <Image source={{ uri: category.imageUrl }} style={styles.image} resizeMode="cover" />
          : <UtensilsCrossed size={23} color={isSelected ? COLORS.primary : COLORS.cocoaSoft} />}
        {isSelected ? <View style={styles.sparkDot} /> : null}
      </Animated.View>
      <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { alignItems: 'center', marginRight: 12, width: 80, minHeight: 96 },
  imageContainer: {
    width: 68, height: 68, borderRadius: 22, overflow: 'hidden', borderWidth: 2,
    borderColor: COLORS.border, marginBottom: 7, backgroundColor: COLORS.cardBackground,
    alignItems: 'center', justifyContent: 'center', ...THEME.shadow.soft,
  },
  image: { width: '100%', height: '100%' },
  imageSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  sparkDot: {
    position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.gold, borderWidth: 1, borderColor: COLORS.parchment,
  },
  name: { fontSize: 12.5, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  nameSelected: { fontWeight: '800', color: COLORS.primaryDark },
});

export default CategoryCard;
