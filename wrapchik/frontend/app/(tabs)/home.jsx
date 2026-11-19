import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, useWindowDimensions, Animated, Easing, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowDownUp, Clock3, ShoppingBag, SlidersHorizontal, Sparkles, MapPin } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';
import Header from '../../components/common/Header';
import SearchBar from '../../components/common/SearchBar';
import CategoryCard from '../../components/category/CategoryCard';
import ProductCard from '../../components/product/ProductCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import ProductListSkeleton from '../../components/common/ProductListSkeleton';
import EnchantedBackdrop from '../../components/enchanted/EnchantedBackdrop';
import WrapooWelcome from '../../components/wrapoo/WrapooWelcome';
import WrapooToast from '../../components/wrapoo/WrapooToast';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import settingsService from '../../services/settingsService';
import favouriteService from '../../services/favouriteService';
import { favouriteStore } from '../../services/favouriteStore';
import useReducedMotion from '../../hooks/useReducedMotion';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const DIET_FILTERS = [
  { id: 'ALL', label: 'Everything' },
  { id: 'VEG', label: 'Veg' },
  { id: 'NON_VEG', label: 'Non-veg' },
];
const SORTS = [
  { field: 'createdAt', order: 'desc', label: 'Latest' },
  { field: 'price', order: 'asc', label: 'Price: low to high' },
  { field: 'price', order: 'desc', label: 'Price: high to low' },
  { field: 'name', order: 'asc', label: 'Name: A–Z' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { cartCount } = useContext(CartContext);
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const productCardWidth = width >= 880 ? '48.7%' : '100%';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [diet, setDiet] = useState('ALL');
  const [sortIndex, setSortIndex] = useState(0);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);
  const listFade = useRef(new Animated.Value(1)).current;
  const [showCartPill, setShowCartPill] = useState(false);
  const cartPill = useRef(new Animated.Value(0)).current;
  const cartPillVisible = useRef(false);
  const welcomeBottom = useRef(0);

  const fetchMenu = useCallback(async ({ refresh = false } = {}) => {
    const thisRequest = ++requestId.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const sort = SORTS[sortIndex];
      const params = {
        search: searchQuery.trim() || undefined,
        category: selectedCategory || undefined,
        veg: diet === 'ALL' ? undefined : String(diet === 'VEG'),
        sortBy: sort.field,
        sortOrder: sort.order,
      };
      const productResult = await productService.getProducts(params);
      if (thisRequest !== requestId.current) return;
      if (!Array.isArray(productResult?.products)) throw new Error('The menu response was invalid.');
      const [categoryResult, settingsResult, popularResult] = await Promise.allSettled([
        categoryService.getCategories(),
        settingsService.getSettings(),
        productService.getPopularProducts(),
      ]);
      if (thisRequest !== requestId.current) return;
      setProducts(productResult.products);
      setCategories(categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value?.categories) ? categoryResult.value.categories : []);
      setSettings(settingsResult.status === 'fulfilled' ? settingsResult.value?.settings || null : null);
      setPopularProducts(popularResult.status === 'fulfilled' && Array.isArray(popularResult.value?.products) ? popularResult.value.products : []);
      setError(false);
    } catch (e) {
      if (thisRequest !== requestId.current) return;
      console.warn('[HomeScreen Load Error]:', e);
      setProducts([]);
      setPopularProducts([]);
      setError(true);
    } finally {
      if (thisRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [diet, searchQuery, selectedCategory, sortIndex]);

  useEffect(() => {
    const timer = setTimeout(() => fetchMenu(), searchQuery ? 250 : 0);
    return () => clearTimeout(timer);
  }, [fetchMenu]);

  // Hydrate shared favourite state for the heart buttons.
  useEffect(() => {
    if (!user?._id) return undefined;
    let active = true;
    favouriteService.getFavourites()
      .then((result) => {
        if (active && Array.isArray(result?.favourites)) favouriteStore.hydrate(result.favourites);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user?._id]);

  // Gentle cross-fade whenever the menu scope changes.
  useEffect(() => {
    if (reducedMotion) { listFade.setValue(1); return; }
    listFade.setValue(0.35);
    Animated.timing(listFade, {
      toValue: 1, duration: 260, easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [diet, listFade, reducedMotion, searchQuery, selectedCategory, sortIndex]);

  const handleScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const threshold = Math.max(120, welcomeBottom.current - 110);
    const visible = offsetY > threshold;
    if (visible === cartPillVisible.current) return;
    cartPillVisible.current = visible;
    setShowCartPill(visible);
  }, []);

  useEffect(() => {
    if (reducedMotion) { cartPill.setValue(showCartPill ? 1 : 0); return; }
    Animated.spring(cartPill, {
      toValue: showCartPill ? 1 : 0,
      friction: 8,
      tension: 90,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [cartPill, reducedMotion, showCartPill]);

  useEffect(() => {
    if (cartCount > 0) return;
    cartPillVisible.current = false;
    setShowCartPill(false);
  }, [cartCount]);

  const handleRefresh = () => fetchMenu({ refresh: true });
  const sortLabel = SORTS[sortIndex].label;
  const closed = settings?.acceptingOrders === false;
  const prepMinutes = settings?.estimatedPrepMinutes;
  const greeting = user?.name?.trim()?.split(/\s+/)[0] || 'there';
  const featuredProducts = useMemo(() => products.slice(0, 2), [products]);

  const wrapooMessage = useMemo(() => {
    if (cartCount > 0) return `${cartCount} ${cartCount === 1 ? 'delicious thing' : 'delicious things'} in your bag! Want to add a little something extra?`;
    if (searchQuery) return 'Hunting for a craving? I can help you sniff it out.';
    if (selectedCategory) return 'Lovely choice. Tap any dish to make it exactly yours.';
    return "Hi, I'm Rapo! Your foodie buddy! Tap my hat whenever you need a little help!";
  }, [cartCount, searchQuery, selectedCategory]);

  return (
    <View style={styles.container}>
      <Header />
      <EnchantedBackdrop />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, cartCount > 0 && styles.scrollContentWithCart]}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={32}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopline}>
            <View style={styles.locationPill}>
              <MapPin size={13} color={COLORS.primaryDark} />
              <Text style={styles.locationText}>TIET · SAC COUNTER</Text>
            </View>
            {prepMinutes ? (
              <View style={styles.timePill}>
                <Clock3 size={13} color={COLORS.cocoaSoft} />
                <Text style={styles.timeText}>~{prepMinutes} min</Text>
              </View>
            ) : null}
            <View style={styles.magicPill}>
              <Sparkles size={12} color={COLORS.goldDeep} />
              <Text style={styles.magicText}>OPEN LATE</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>FRESHLY MADE ON CAMPUS</Text>
          <Text style={styles.heroTitle}>
            Cravings calling?{greeting !== 'there' ? ` Hey ${greeting}!` : ''}
            {'\n'}
            <Text style={styles.heroAccent}>We’ve got you! 🍟</Text>
          </Text>
          <Text style={styles.heroSub}>Fresh bites, happy vibes, delivered your way.</Text>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} onClear={() => setSearchQuery('')} style={styles.searchWrap} />

          {closed ? (
            <View style={styles.closedBanner}>
              <Text style={styles.closedTitle}>The café is taking a tiny nap</Text>
              <Text style={styles.closedCopy}>Ordering is paused right now. The menu is still lovely to browse.</Text>
            </View>
          ) : null}
        </View>

        <View onLayout={(event) => { welcomeBottom.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height; }}>
          <WrapooWelcome message={wrapooMessage} />
        </View>

        <View style={styles.pickupStrip}>
          <View style={styles.pickupIcon}><ShoppingBag size={18} color={COLORS.primaryDark} /></View>
          <View style={styles.pickupCopy}>
            <Text style={styles.pickupTitle}>Pickup at the Wrapchik counter</Text>
            <Text style={styles.pickupSub}>SAC ground floor · delivery and dine-in available</Text>
          </View>
          <Sparkles size={16} color={COLORS.gold} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>FIND YOUR FAVOURITE</Text>
              <Text style={styles.sectionTitle}>Browse the menu</Text>
            </View>
            <TouchableOpacity
              style={styles.textLink}
              onPress={() => { setSelectedCategory(null); setDiet('ALL'); }}
              accessibilityRole="button"
              accessibilityLabel="Show all menu items"
            >
              <Text style={styles.textLinkLabel}>View all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            <CategoryCard category={{ _id: null, name: 'All items' }} isSelected={!selectedCategory} onPress={() => setSelectedCategory(null)} />
            {categories.map((category) => (
              <CategoryCard key={category._id} category={category} isSelected={selectedCategory === category._id} onPress={() => setSelectedCategory(category._id)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>FRESH OFF THE GRILL</Text>
              <Text style={styles.sectionTitle}>Just off the griddle</Text>
            </View>
          </View>
          {error ? <ErrorState onRetry={handleRefresh} retrying={refreshing} /> : loading && !refreshing ? <ProductListSkeleton count={2} /> : featuredProducts.length ? (
            <View style={styles.featuredRow}>
              {featuredProducts.map((product) => (
                <TouchableOpacity
                  key={product._id}
                  onPress={() => router.push(`/product/${product._id}`)}
                  style={styles.featuredCard}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${product.name}`}
                >
                  {product.imageUrl
                    ? <Image source={{ uri: product.imageUrl }} style={styles.featuredImage} resizeMode="cover" />
                    : <View style={[styles.featuredImage, styles.imageFallback]}><ShoppingBag size={24} color={COLORS.primary} /></View>}
                  <View style={styles.featuredOverlay}>
                    <Text style={styles.featuredName} numberOfLines={1}>{product.name}</Text>
                    <Text style={styles.featuredPrice}>₹{product.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {popularProducts.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>CAMPUS FAVOURITES · LAST 30 DAYS</Text>
                <Text style={styles.sectionTitle}>Everyone’s ordering</Text>
              </View>
            </View>
            <View style={styles.featuredRow}>
              {popularProducts.map((product) => (
                <TouchableOpacity
                  key={product._id}
                  onPress={() => router.push(`/product/${product._id}`)}
                  style={styles.featuredCard}
                  accessibilityRole="button"
                  accessibilityLabel={`Popular item ${product.name}, ${product.totalQuantity} sold in the last 30 days`}
                >
                  {product.imageUrl
                    ? <Image source={{ uri: product.imageUrl }} style={styles.featuredImage} resizeMode="cover" />
                    : <View style={[styles.featuredImage, styles.imageFallback]}><ShoppingBag size={24} color={COLORS.primary} /></View>}
                  <View style={styles.featuredOverlay}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featuredName} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.popularCount}>{product.totalQuantity} sold</Text>
                    </View>
                    <Text style={styles.featuredPrice}>₹{product.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.menuSection}>
          <View style={styles.menuHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>THE WRAPCHIK MENU</Text>
              <Text style={styles.sectionTitle}>{searchQuery ? 'Search results' : selectedCategory ? 'Your little selection' : 'Made for your cravings'}</Text>
            </View>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setSortIndex((sortIndex + 1) % SORTS.length)}
              accessibilityRole="button"
              accessibilityLabel={`Sort menu. Current: ${sortLabel}`}
            >
              <ArrowDownUp size={14} color={COLORS.cocoa} />
              <Text style={styles.sortText}>{sortLabel}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.filtersRow}>
            <SlidersHorizontal size={15} color={COLORS.cocoaMuted} />
            {DIET_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setDiet(filter.id)}
                style={[styles.filterChip, diet === filter.id && styles.filterChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: diet === filter.id }}
              >
                <Text style={[styles.filterText, diet === filter.id && styles.filterTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? null : loading && !refreshing ? (
            <ProductListSkeleton />
          ) : products.length === 0 ? (
            <EmptyState
              title={searchQuery ? 'Nothing matches that craving yet' : 'The menu is resting'}
              message={searchQuery ? 'Try another dish name, or clear your filters.' : 'There are no items in this menu yet. Please check back soon.'}
              buttonTitle={searchQuery || selectedCategory || diet !== 'ALL' ? 'Clear filters' : undefined}
              onButtonPress={() => { setSearchQuery(''); setSelectedCategory(null); setDiet('ALL'); }}
            />
          ) : (
            <Animated.View style={[styles.productList, { opacity: listFade }]}>
              {products.map((item) => (
                <View key={item._id} style={[styles.productCell, { width: productCardWidth }]}>
                  <ProductCard product={item} onPress={() => router.push(`/product/${item._id}`)} />
                </View>
              ))}
            </Animated.View>
          )}
        </View>

        <View style={styles.footerNote}>
          <Sparkles size={13} color={COLORS.gold} />
          <Text style={styles.footerNoteText}>Made with love for the TIET campus community</Text>
        </View>
      </ScrollView>

      {cartCount > 0 ? (
        <Animated.View
          pointerEvents={showCartPill ? 'auto' : 'none'}
          accessibilityElementsHidden={!showCartPill}
          importantForAccessibility={showCartPill ? 'auto' : 'no-hide-descendants'}
          style={[
            styles.cartFloatingWrap,
            {
              opacity: cartPill,
              transform: [{ translateY: cartPill.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.cartFloating}
            onPress={() => router.push('/(tabs)/cart')}
            accessibilityRole="button"
            accessibilityLabel={`Open cart with ${cartCount} items`}
          >
            <ShoppingBag size={18} color="#FFFFFF" />
            <Text style={styles.cartFloatingText}>View your bag</Text>
            <View style={styles.cartCount}><Text style={styles.cartCountText}>{cartCount}</Text></View>
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      <WrapooToast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 42, maxWidth: THEME.layout.pageMaxWidth, width: '100%', alignSelf: 'center' },
  scrollContentWithCart: { paddingBottom: 118 },
  hero: { paddingHorizontal: THEME.layout.pageGutter, paddingTop: 14, paddingBottom: 18 },
  heroTopline: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 20, flexWrap: 'wrap' },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.cardBackground,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: THEME.radius.pill,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  locationText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.6, color: COLORS.cocoa },
  timePill: {
    flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: THEME.radius.pill, backgroundColor: COLORS.surfaceMuted,
  },
  timeText: { fontSize: 10.5, fontWeight: '800', color: COLORS.cocoaSoft },
  magicPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 7,
    borderRadius: THEME.radius.pill, backgroundColor: COLORS.goldLight, borderWidth: 1, borderColor: 'rgba(217,164,65,0.45)',
  },
  magicText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9, color: COLORS.goldDeep },
  eyebrow: { color: COLORS.primaryDark, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.7, marginBottom: 8 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 31, lineHeight: 38, fontWeight: '900', maxWidth: 560, letterSpacing: -0.3 },
  heroAccent: { color: COLORS.primary },
  heroSub: { color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 20, marginTop: 7, maxWidth: 460 },
  searchWrap: {
    marginHorizontal: 0, marginVertical: 0, marginTop: 17, height: 54,
    borderRadius: THEME.radius.md, paddingHorizontal: 15, shadowOpacity: 0.1, elevation: 2,
  },
  closedBanner: { marginTop: 14, backgroundColor: COLORS.warningLight, padding: 13, borderRadius: THEME.radius.md, borderWidth: 1, borderColor: 'rgba(178,106,18,0.2)' },
  closedTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '900' },
  closedCopy: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
  pickupStrip: {
    marginHorizontal: THEME.layout.pageGutter, marginTop: 14, padding: 13,
    backgroundColor: 'rgba(255,233,218,0.82)', borderRadius: THEME.radius.lg,
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderWidth: 1, borderColor: 'rgba(242,96,31,0.16)',
  },
  pickupIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.parchment },
  pickupCopy: { flex: 1 },
  pickupTitle: { fontSize: 13.5, fontWeight: '900', color: COLORS.textPrimary },
  pickupSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2, lineHeight: 16 },
  section: { marginTop: 27 },
  sectionHeading: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 13 },
  sectionEyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.4, color: COLORS.goldDeep, marginBottom: 4 },
  sectionTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.2 },
  textLink: { padding: 8, minHeight: 40, justifyContent: 'center' },
  textLinkLabel: { color: COLORS.primaryDark, fontSize: 12.5, fontWeight: '900' },
  categoryList: { paddingHorizontal: THEME.layout.pageGutter, paddingBottom: 4, paddingTop: 2 },
  featuredRow: { flexDirection: 'row', paddingHorizontal: THEME.layout.pageGutter, gap: 12 },
  featuredCard: {
    flex: 1, minWidth: 0, height: 158, borderRadius: THEME.radius.lg, overflow: 'hidden',
    backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border, ...THEME.shadow.soft,
  },
  featuredImage: { width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  featuredOverlay: {
    position: 'absolute', left: 8, right: 8, bottom: 8, padding: 9,
    backgroundColor: 'rgba(58, 35, 24, 0.82)', borderRadius: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  featuredName: { flex: 1, color: '#FFF7EC', fontSize: 12.5, fontWeight: '800' },
  featuredPrice: { color: '#FBEFCF', fontSize: 12.5, fontWeight: '900' },
  popularCount: { color: '#F6C9B5', fontSize: 9.5, fontWeight: '700', marginTop: 2 },
  menuSection: { marginTop: 30 },
  menuHeading: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  sortButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, minHeight: 40,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: THEME.radius.pill, backgroundColor: COLORS.cardBackground,
  },
  sortText: { fontSize: 10.5, fontWeight: '800', color: COLORS.textPrimary },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: THEME.layout.pageGutter, marginBottom: 14 },
  filterChip: {
    minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: THEME.radius.pill,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBackground,
  },
  filterChipActive: { backgroundColor: COLORS.cocoa, borderColor: COLORS.cocoa },
  filterText: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary },
  filterTextActive: { color: '#FFF7EC' },
  productList: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productCell: { minWidth: 0 },
  footerNote: { paddingTop: 24, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  footerNoteText: { fontSize: 11, color: COLORS.cocoaMuted, fontWeight: '600' },
  cartFloatingWrap: {
    position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center', zIndex: 30,
  },
  cartFloating: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: 52, borderRadius: THEME.radius.pill, paddingHorizontal: 18, backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.gold, ...THEME.shadow.lifted,
  },
  cartFloatingText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13.5 },
  cartCount: { minWidth: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.goldLight },
  cartCountText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: '900' },
});
