import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Easing, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Plus, Minus, ShoppingBag, Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import { useCompanion } from '../../context/CompanionContext';
import { useFlyToCart } from '../../context/FlyToCartContext';
import favouriteService from '../../services/favouriteService';
import { favouriteStore } from '../../services/favouriteStore';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const CELEBRATIONS = ['Wohoo! Great pick!', 'Into the bag it goes! ✨', 'Chef’s little helper approves.', 'Ooh, excellent craving.'];

const ProductCard = ({ product, onPress, showFavourite = true }) => {
  const { cartItems, addToCart, updateQuantity, removeFromCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const { celebrate } = useCompanion();
  const { flyToCart } = useFlyToCart();
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();

  const isAvailable = product.available !== false;
  const existingItem = cartItems.find((item) => item.productId === product._id);
  const quantityInCart = existingItem ? existingItem.quantity : 0;

  const [isFavourite, setIsFavourite] = useState(() => favouriteStore.has(product._id));
  const [favouriteBusy, setFavouriteBusy] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const quantityScale = useRef(new Animated.Value(1)).current;
  const imageRef = useRef(null);

  useEffect(() => {
    if (!quantityInCart || reducedMotion) return;
    quantityScale.setValue(0.76);
    Animated.spring(quantityScale, {
      toValue: 1, friction: 4, tension: 150, useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [quantityInCart, quantityScale, reducedMotion]);

  useEffect(() => favouriteStore.subscribe((ids) => setIsFavourite(ids.has(String(product._id)))), [product._id]);

  const popHeart = () => {
    if (reducedMotion) return;
    heartScale.setValue(0.7);
    Animated.spring(heartScale, { toValue: 1, friction: 3, tension: 140, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  const toggleFavourite = useCallback(async (event) => {
    event?.stopPropagation?.();
    if (favouriteBusy) return;
    if (!user) {
      router.push({ pathname: '/(auth)/login', params: { returnTo: 'home' } });
      return;
    }
    const next = !isFavourite;
    setIsFavourite(next);
    favouriteStore.toggle(product._id);
    popHeart();
    setFavouriteBusy(true);
    try {
      const response = next
        ? await favouriteService.addFavourite(product._id)
        : await favouriteService.removeFavourite(product._id);
      if (!response?.success) throw new Error(response?.message || 'Favourite could not be saved.');
    } catch (error) {
      setIsFavourite(!next);
      favouriteStore.toggle(product._id);
    } finally {
      setFavouriteBusy(false);
    }
  }, [favouriteBusy, isFavourite, product._id, router, user]);

  const launchFlight = (event) => {
    const message = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
    if (reducedMotion) {
      celebrate(message, { mood: 'cheer' });
      return;
    }
    const native = event?.nativeEvent;
    const fallback = { x: native?.pageX ?? width / 2 - 22, y: native?.pageY ?? 240, w: 0, h: 0 };
    let launched = false;
    const launch = (rect) => {
      if (launched) return;
      launched = true;
      flyToCart({ imageUrl: product.imageUrl, start: rect || fallback });
    };
    if (imageRef.current?.measureInWindow) {
      imageRef.current.measureInWindow((x, y, w, h) => launch({ x, y, w, h }));
      setTimeout(() => launch(fallback), 80);
    } else {
      launch(fallback);
    }
    setTimeout(() => celebrate(message, { mood: 'cheer' }), 640);
  };

  const handleAdd = (e) => {
    e?.stopPropagation?.();
    if (!isAvailable) return;
    addToCart(product, [], 1);
    launchFlight(e);
  };

  const handleIncrement = (e) => {
    e?.stopPropagation?.();
    if (existingItem) {
      if (quantityInCart < 50) updateQuantity(existingItem.cartKey, quantityInCart + 1);
    } else {
      addToCart(product, [], 1);
      launchFlight(e);
    }
  };

  const handleDecrement = (e) => {
    e?.stopPropagation?.();
    if (existingItem) {
      if (quantityInCart > 1) updateQuantity(existingItem.cartKey, quantityInCart - 1);
      else removeFromCart(existingItem.cartKey);
    }
  };

  const onHoverIn = () => {
    if (reducedMotion) return;
    Animated.timing(lift, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
  };
  const onHoverOut = () => {
    Animated.timing(lift, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
  };

  const animatedCardStyle = {
    transform: [
      { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
      { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) },
    ],
  };

  return (
    <Pressable onHoverIn={onHoverIn} onHoverOut={onHoverOut} style={styles.pressWrap} accessibilityRole="none">
      <Animated.View style={[styles.card, !isAvailable && styles.cardUnavailable, animatedCardStyle]}>
        <View ref={imageRef} style={styles.imageContainer} collapsable={false}>
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`View ${product.name} details`}
            style={styles.imageTouch}
          >
            {product.imageUrl
              ? <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="cover" />
              : <View style={[styles.image, styles.imageFallback]}><ShoppingBag size={26} color={COLORS.primary} /></View>}
            <View style={[styles.vegBadge, { borderColor: product.isVeg ? COLORS.vegGreen : COLORS.nonVegRed }]}>
              <View style={[styles.vegDot, { backgroundColor: product.isVeg ? COLORS.vegGreen : COLORS.nonVegRed }]} />
            </View>

            {!isAvailable ? (
              <View style={styles.unavailableOverlay}>
                <Text style={styles.unavailableText}>Back on the menu soon</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {showFavourite ? (
          <TouchableOpacity
            onPress={toggleFavourite}
            style={styles.heartBtn}
            disabled={favouriteBusy}
            accessibilityRole="button"
            accessibilityLabel={isFavourite ? `Remove ${product.name} from favourites` : `Save ${product.name} to favourites`}
            accessibilityState={{ selected: isFavourite, busy: favouriteBusy }}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Heart size={17} color={isFavourite ? COLORS.primary : COLORS.cocoaSoft} fill={isFavourite ? COLORS.primary : 'transparent'} />
            </Animated.View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.content}>
          <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`View ${product.name} details`}>
            <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
            <Text style={styles.description} numberOfLines={2}>{product.description}</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.price}>₹{product.price}</Text>

            {quantityInCart > 0 && isAvailable ? (
              <Animated.View style={[styles.stepperBox, { transform: [{ scale: quantityScale }] }]}>
                <TouchableOpacity onPress={handleDecrement} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel={`Remove one ${product.name}`}>
                  <Minus size={15} color={COLORS.primaryDark} />
                </TouchableOpacity>
                <Text style={styles.stepperQty}>{quantityInCart}</Text>
                <TouchableOpacity onPress={handleIncrement} disabled={quantityInCart >= 50} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel={`Add one ${product.name}`}>
                  <Plus size={15} color={COLORS.primaryDark} />
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <TouchableOpacity
                onPress={handleAdd}
                disabled={!isAvailable}
                accessibilityRole="button"
                accessibilityLabel={isAvailable ? `Add ${product.name} to cart` : `${product.name} unavailable`}
                style={[styles.addBtn, !isAvailable && styles.addBtnDisabled]}
              >
                <Plus size={17} color={isAvailable ? '#FFFFFF' : '#A79A8C'} />
                <Text style={[styles.addBtnText, !isAvailable && styles.addBtnTextDisabled]}>ADD</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressWrap: { width: '100%' },
  card: {
    backgroundColor: COLORS.cardBackground,
    shadowOpacity: 0.1,
    borderRadius: THEME.radius.lg,
    marginBottom: 12,
    flexDirection: 'row',
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#5A3620',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  cardUnavailable: { opacity: 0.78, backgroundColor: COLORS.surfaceMuted },
  imageContainer: { width: 98, height: 98, borderRadius: THEME.radius.md, overflow: 'hidden', position: 'relative' },
  imageTouch: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted },
  vegBadge: {
    position: 'absolute', top: 6, left: 6, width: 16, height: 16, borderWidth: 1.5, borderRadius: 4,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
  },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(66, 40, 27, 0.62)',
    justifyContent: 'center', alignItems: 'center', padding: 6,
  },
  unavailableText: { color: '#FFF7EC', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  heartBtn: {
    position: 'absolute', top: 8, left: 60, width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,253,248,0.94)', zIndex: 4,
    borderWidth: 1, borderColor: 'rgba(235,220,198,0.9)',
  },
  content: { flex: 1, marginLeft: 13, justifyContent: 'space-between', paddingRight: 2 },
  name: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 0.1 },
  description: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3, lineHeight: 17, paddingRight: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  price: { fontSize: 17, fontWeight: '900', color: COLORS.primaryDark },
  addBtn: {
    backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, minHeight: 38, borderRadius: THEME.radius.pill, gap: 3,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6, elevation: 2,
  },
  addBtnDisabled: { backgroundColor: COLORS.border, shadowOpacity: 0, elevation: 0 },
  addBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900', letterSpacing: 0.4 },
  addBtnTextDisabled: { color: '#A79A8C' },
  stepperBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: THEME.radius.pill, height: 38, paddingHorizontal: 3,
  },
  stepperBtn: { paddingHorizontal: 9, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', minWidth: 34 },
  stepperQty: { fontSize: 14, fontWeight: '900', color: COLORS.primaryDark, paddingHorizontal: 2, minWidth: 18, textAlign: 'center' },
});

export default ProductCard;
