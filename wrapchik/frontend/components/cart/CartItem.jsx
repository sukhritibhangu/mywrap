import React, { useContext } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import COLORS from '../../constants/colors';

const CartItem = ({ item }) => {
  const { updateQuantity, removeFromCart } = useContext(CartContext);

  const hasCustomizations = item.customizations && item.customizations.length > 0;

  return (
    <View style={styles.container}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" /> : <View style={[styles.image, styles.imageFallback]}><ShoppingBag size={20} color={COLORS.primary} /></View>}

      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>

        {hasCustomizations && (
          <Text style={styles.customizations} numberOfLines={1}>
            {item.customizations.map((c) => `${c.name} (+₹${c.price})`).join(', ')}
          </Text>
        )}

        <Text style={styles.price}>₹{item.unitPrice * item.quantity}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => removeFromCart(item.cartKey)} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
          <Trash2 size={16} color={COLORS.danger} />
        </TouchableOpacity>

        <View style={styles.stepper}>
          <TouchableOpacity
            onPress={() => updateQuantity(item.cartKey, item.quantity - 1)}
            style={styles.stepperBtn}
            accessibilityRole="button"
            accessibilityLabel={`Remove one ${item.name}`}
          >
            <Minus size={14} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.quantity}>{item.quantity}</Text>

          <TouchableOpacity
            onPress={() => updateQuantity(item.cartKey, item.quantity + 1)}
            style={styles.stepperBtn}
            disabled={item.quantity >= 50}
            accessibilityRole="button"
            accessibilityLabel={`Add one ${item.name}`}
          >
            <Plus size={14} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted },
  details: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  customizations: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  actions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 64,
  },
  deleteBtn: {
    padding: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtn: {
    padding: 4,
  },
  quantity: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginHorizontal: 8,
  },
});

export default CartItem;
