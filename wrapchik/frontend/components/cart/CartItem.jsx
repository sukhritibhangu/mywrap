import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const CartItem = ({ item, index = 0 }) => {
  const { updateQuantity, removeFromCart } = useContext(CartContext);
  const hasCustomizations = item.customizations && item.customizations.length > 0;
  const reducedMotion = useReducedMotion();
  const drop = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) { drop.setValue(1); return; }
    Animated.spring(drop, {
      toValue: 1, delay: Math.min(index, 5) * 55, friction: 7, tension: 72,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [drop, index, reducedMotion]);

  const dropStyle = {
    opacity: drop,
    transform: [
      { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] }) },
      { scale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };

  return (
    <Animated.View style={[styles.container, dropStyle]}>
      {item.imageUrl
        ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
        : <View style={[styles.image, styles.imageFallback]}><ShoppingBag size={20} color={COLORS.primary} /></View>}

      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {hasCustomizations ? (
          <Text style={styles.customizations} numberOfLines={1}>
            {item.customizations.map((c) => `${c.name} (+₹${c.price})`).join(', ')}
          </Text>
        ) : null}
        <Text style={styles.price}>₹{item.unitPrice * item.quantity}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => removeFromCart(item.cartKey)}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}
          hitSlop={6}
        >
          <Trash2 size={16} color={COLORS.danger} />
        </TouchableOpacity>

        <View style={styles.stepper}>
          <TouchableOpacity
            onPress={() => updateQuantity(item.cartKey, item.quantity - 1)}
            style={styles.stepperBtn}
            accessibilityRole="button"
            accessibilityLabel={`Remove one ${item.name}`}
          >
            <Minus size={14} color={COLORS.cocoa} />
          </TouchableOpacity>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <TouchableOpacity
            onPress={() => updateQuantity(item.cartKey, item.quantity + 1)}
            style={styles.stepperBtn}
            disabled={item.quantity >= 50}
            accessibilityRole="button"
            accessibilityLabel={`Add one ${item.name}`}
          >
            <Plus size={14} color={COLORS.cocoa} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBackground,
    padding: 12, borderRadius: THEME.radius.lg, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border, ...THEME.shadow.soft,
  },
  image: { width: 66, height: 66, borderRadius: THEME.radius.md },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted },
  details: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  customizations: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '900', color: COLORS.primaryDark, marginTop: 5 },
  actions: { alignItems: 'flex-end', justifyContent: 'space-between', height: 66 },
  deleteBtn: { padding: 4, minWidth: 32, minHeight: 32, alignItems: 'flex-end' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBackground,
    borderRadius: THEME.radius.pill, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 3,
  },
  stepperBtn: { padding: 6, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  quantity: { fontSize: 14, fontWeight: '900', color: COLORS.textPrimary, marginHorizontal: 4, minWidth: 16, textAlign: 'center' },
});

export default CartItem;
