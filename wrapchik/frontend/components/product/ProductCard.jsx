import React, { useContext } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Minus, ShoppingBag } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import COLORS from '../../constants/colors';

const ProductCard = ({ product, onPress }) => {
  const { cartItems, addToCart, updateQuantity, removeFromCart } = useContext(CartContext);

  const isAvailable = product.available !== false;

  // Check if product already exists in cart
  const existingItem = cartItems.find((item) => item.productId === product._id);
  const quantityInCart = existingItem ? existingItem.quantity : 0;

  const handleAdd = (e) => {
    e?.stopPropagation?.();
    if (isAvailable) {
      addToCart(product, [], 1);
    }
  };

  const handleIncrement = (e) => {
    e?.stopPropagation?.();
    if (existingItem) {
      if (quantityInCart < 50) updateQuantity(existingItem.cartKey, quantityInCart + 1);
    } else {
      addToCart(product, [], 1);
    }
  };

  const handleDecrement = (e) => {
    e?.stopPropagation?.();
    if (existingItem) {
      if (quantityInCart > 1) {
        updateQuantity(existingItem.cartKey, quantityInCart - 1);
      } else {
        removeFromCart(existingItem.cartKey);
      }
    }
  };

  return (
    <View style={[styles.card, !isAvailable && styles.cardUnavailable]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`View ${product.name} details`}
        style={styles.imageContainer}
      >
        {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="cover" /> : <View style={[styles.image, styles.imageFallback]}><ShoppingBag size={26} color={COLORS.primary} /></View>}
        <View style={[styles.vegBadge, { borderColor: product.isVeg ? COLORS.vegGreen : COLORS.nonVegRed }]}>
          <View style={[styles.vegDot, { backgroundColor: product.isVeg ? COLORS.vegGreen : COLORS.nonVegRed }]} />
        </View>

        {!isAvailable && (
          <View style={styles.unavailableOverlay}>
            <Text style={styles.unavailableText}>Currently Unavailable</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.content}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`View ${product.name} details`}>
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {product.description}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.price}>₹{product.price}</Text>

          {quantityInCart > 0 && isAvailable ? (
            <View style={styles.stepperBox}>
              <TouchableOpacity onPress={handleDecrement} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel={`Remove one ${product.name}`}>
                <Minus size={14} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperQty}>{quantityInCart}</Text>
              <TouchableOpacity onPress={handleIncrement} disabled={quantityInCart >= 50} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel={`Add one ${product.name}`}>
                <Plus size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleAdd}
              disabled={!isAvailable}
              accessibilityRole="button"
              accessibilityLabel={isAvailable ? `Add ${product.name} to cart` : `${product.name} unavailable`}
              style={[styles.addBtn, !isAvailable && styles.addBtnDisabled]}
            >
              <Plus size={16} color={isAvailable ? '#FFFFFF' : '#9E9E9E'} />
              <Text style={[styles.addBtnText, !isAvailable && styles.addBtnTextDisabled]}>
                ADD
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardUnavailable: {
    opacity: 0.75,
    backgroundColor: '#F9FAFB',
  },
  imageContainer: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted },
  vegBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  unavailableText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnDisabled: {
    backgroundColor: '#E0E0E0',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  addBtnTextDisabled: {
    color: '#9E9E9E',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    height: 32,
    paddingHorizontal: 4,
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperQty: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
    paddingHorizontal: 6,
    minWidth: 20,
    textAlign: 'center',
  },
});

export default ProductCard;
