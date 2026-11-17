import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Heart, Minus, Plus, Check, ShoppingBag } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import ErrorState from '../../components/common/ErrorState';
import productService from '../../services/productService';
import favouriteService from '../../services/favouriteService';
import { favouriteStore } from '../../services/favouriteStore';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addToCart } = useContext(CartContext);

  const { user } = useContext(AuthContext);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [favouriteBusy, setFavouriteBusy] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedCustomizations, setSelectedCustomizations] = useState([]);
  const [isFavourite, setIsFavourite] = useState(false);

  useEffect(() => {
    fetchProduct();
    if (user) {
      checkIfFavourite();
    }
  }, [id, user]);

  const checkIfFavourite = async () => {
    try {
      const res = await favouriteService.getFavourites();
      if (res.success) {
        const isFav = (res.favourites || []).some(fav => fav._id === id);
        setIsFavourite(isFav);
      }
    } catch (e) {
      console.warn('Error fetching favourites', e);
    }
  };

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      const res = await productService.getProductById(id);
      if (res.success && res.product) {
        setProduct(res.product);
        setLoadError(false);
      } else throw new Error('Product was not found.');
    } catch (e) {
      console.warn('[ProductDetail Load Error]:', e);
      setProduct(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const toggleFavouriteAPI = async () => {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    if (favouriteBusy) return;
    setFavouriteBusy(true);
    const prev = isFavourite;
    setIsFavourite(!prev); // Optimistic update
    if (prev) favouriteStore.remove(id);
    else favouriteStore.add(id);
    try {
      if (prev) {
        const response = await favouriteService.removeFavourite(id);
        if (!response?.success) throw new Error(response?.message || 'Favourite could not be removed.');
      } else {
        const response = await favouriteService.addFavourite(id);
        if (!response?.success) throw new Error(response?.message || 'Favourite could not be saved.');
      }
    } catch (error) {
      setIsFavourite(prev); // Revert on failure
      if (prev) favouriteStore.add(id);
      else favouriteStore.remove(id);
      Alert.alert('Could not update favourite', error?.message || 'Please try again.');
    } finally {
      setFavouriteBusy(false);
    }
  };

  const toggleCustomization = (cust) => {
    if (selectedCustomizations.some((c) => c.name === cust.name)) {
      setSelectedCustomizations(selectedCustomizations.filter((c) => c.name !== cust.name));
    } else {
      setSelectedCustomizations([...selectedCustomizations, cust]);
    }
  };

  if (loading) return <View style={styles.container}><Header title="Menu item" showBack showCart={false} /><LoadingIndicator message="Loading product details…" /></View>;
  if (loadError || !product) return <View style={styles.container}><Header title="Menu item" showBack showCart={false} /><ErrorState title="We couldn’t load this item" message="It may have been removed or the menu service is unavailable." onRetry={fetchProduct} /></View>;

  const custSubtotal = selectedCustomizations.reduce((sum, c) => sum + c.price, 0);
  const unitPrice = product.price + custSubtotal;
  const totalPrice = unitPrice * quantity;
  const isAvailable = product.available !== false;

  const handleAddToCart = () => {
    if (!isAvailable) {
      Alert.alert('Item Unavailable', 'This product is currently out of stock.');
      return;
    }

    addToCart(product, selectedCustomizations, quantity);
    Alert.alert(
      'Added to Cart! 🌯',
      `${quantity} × ${product.name} added to your cart.`,
      [
        { text: 'Keep Browsing', style: 'cancel' },
        { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header title={product.name} showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Image & Overlay */}
        <View style={styles.heroBox}>
          {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.heroImage} resizeMode="cover" /> : <View style={[styles.heroImage, styles.imageFallback]}><ShoppingBag size={40} color={COLORS.primary} /></View>}

          <TouchableOpacity
            onPress={toggleFavouriteAPI}
            style={styles.favBtn}
            disabled={favouriteBusy}
            accessibilityRole="button"
            accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Save to favourites'}
          >
            <Heart size={20} color={isFavourite ? COLORS.danger : COLORS.textSecondary} fill={isFavourite ? COLORS.danger : 'transparent'} />
          </TouchableOpacity>

          {!isAvailable && (
            <View style={styles.unavailableBanner}>
              <Text style={styles.unavailableText}>Currently Unavailable</Text>
            </View>
          )}
        </View>

        {/* Product Meta Header */}
        <View style={styles.detailsBox}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{product.name}</Text>
            <View style={[styles.vegBadge, { borderColor: product.isVeg ? COLORS.vegGreen : COLORS.nonVegRed }]}>
              <View style={[styles.vegDot, { backgroundColor: product.isVeg ? COLORS.vegGreen : COLORS.nonVegRed }]} />
            </View>
          </View>

          <View style={styles.priceRow}><Text style={styles.price}>₹{product.price}</Text><Text style={styles.priceUnit}> / item</Text></View>
          <Text style={styles.description}>{product.description}</Text>
        </View>

        {/* Customization Options */}
        {product.customizations && product.customizations.length > 0 && (
          <View style={styles.custSection}>
            <Text style={styles.custTitle}>Customizations</Text>

            {product.customizations.map((cust, idx) => {
              const isSelected = selectedCustomizations.some((c) => c.name === cust.name);
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleCustomization(cust)}
                  activeOpacity={0.8}
                  style={[styles.custCard, isSelected && styles.custCardSelected]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${cust.name}, additional ₹${cust.price}`}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Check size={14} color="#FFFFFF" />}
                  </View>

                  <Text style={styles.custName}>{cust.name}</Text>
                  <Text style={styles.custPrice}>+₹{cust.price}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Quantity Selector Row */}
        <View style={styles.quantityRow}>
          <Text style={styles.quantityLabel}>Quantity</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
              style={styles.stepperBtn}
            >
              <Minus size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <Text style={styles.quantityValue}>{quantity}</Text>

            <TouchableOpacity
              onPress={() => setQuantity(quantity + 1)}
              style={styles.stepperBtn}
              disabled={quantity >= 50}
              accessibilityRole="button"
              accessibilityLabel="Add one"
            >
              <Plus size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Footer Floating CTA */}
      <View style={styles.footer}>
        <Button
          title={isAvailable ? `Add to Cart • ₹${totalPrice}` : 'Out of Stock'}
          onPress={handleAddToCart}
          disabled={!isAvailable}
          style={styles.addCartBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 20,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  heroBox: {
    width: '100%',
    height: 240,
    position: 'relative',
    alignSelf: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted },
  favBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    width: 46,
    height: 46,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  unavailableBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(211, 47, 47, 0.9)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  unavailableText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  detailsBox: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    flex: 1,
  },
  vegBadge: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  price: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
    marginTop: 6,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  priceUnit: { fontSize: 12, color: COLORS.textSecondary },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  custSection: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  custTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  custCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  custCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  custName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  custPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepperBtn: {
    padding: 6,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginHorizontal: 12,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingHorizontal: THEME.layout.pageGutter,
    maxWidth: THEME.layout.pageMaxWidth,
    width: '100%',
    alignSelf: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addCartBtn: {
    width: '100%',
  },
});
