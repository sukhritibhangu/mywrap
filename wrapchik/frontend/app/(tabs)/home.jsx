import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowDownUp, Clock3, ShoppingBag, SlidersHorizontal, Sparkles } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';
import Header from '../../components/common/Header';
import SearchBar from '../../components/common/SearchBar';
import CategoryCard from '../../components/category/CategoryCard';
import ProductCard from '../../components/product/ProductCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import ProductListSkeleton from '../../components/common/ProductListSkeleton';
import productService from '../../services/productService';
import categoryService from '../../services/categoryService';
import settingsService from '../../services/settingsService';
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
      const [categoryResult, settingsResult, popularResult] = await Promise.allSettled([categoryService.getCategories(), settingsService.getSettings(), productService.getPopularProducts()]);
      if (thisRequest !== requestId.current) return;
      setProducts(productResult.products);
      setCategories(categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value?.categories) ? categoryResult.value.categories : []);
      setSettings(settingsResult.status === 'fulfilled' ? settingsResult.value?.settings || null : null);
      setPopularProducts(popularResult.status === 'fulfilled' && Array.isArray(popularResult.value?.products) ? popularResult.value.products : []);
      setError(false);
    } catch (e) {
      if (thisRequest !== requestId.current) return;
      // A retryable inline state is shown to the customer; keep expected offline/API failures out of the red dev LogBox.
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

  const handleRefresh = () => fetchMenu({ refresh: true });
  const sortLabel = SORTS[sortIndex].label;
  const closed = settings?.acceptingOrders === false;
  const prepMinutes = settings?.estimatedPrepMinutes;
  const greeting = user?.name?.trim()?.split(/\s+/)[0] || 'there';
  const featuredProducts = useMemo(() => products.slice(0, 2), [products]);

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopline}>
            <View style={styles.locationPill}><ShoppingBag size={14} color={COLORS.primary} /><Text style={styles.locationText}>TIET · SAC COUNTER</Text></View>
            {prepMinutes ? <View style={styles.timePill}><Clock3 size={14} color={COLORS.textSecondary} /><Text style={styles.timeText}>~{prepMinutes} min</Text></View> : null}
          </View>
          <Text style={styles.eyebrow}>GOOD FOOD, RIGHT ON CAMPUS</Text>
          <Text style={styles.heroTitle}>Hey {greeting},<Text style={styles.heroAccent}> what sounds good?</Text></Text>
          <Text style={styles.heroSub}>Fresh picks from the Wrapchik counter, ready when you are.</Text>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} onClear={() => setSearchQuery('')} style={styles.searchWrap} />
          {closed ? <View style={styles.closedBanner}><Text style={styles.closedTitle}>Ordering is paused right now</Text><Text style={styles.closedCopy}>Check back soon. The live menu is still available to browse.</Text></View> : null}
        </View>

        <View style={styles.pickupStrip}>
          <View style={styles.pickupIcon}><ShoppingBag size={18} color={COLORS.primary} /></View>
          <View style={styles.pickupCopy}><Text style={styles.pickupTitle}>Pickup at Wrapchik</Text><Text style={styles.pickupSub}>SAC counter · choose pickup at checkout</Text></View>
          <Sparkles size={17} color={COLORS.secondary} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionEyebrow}>FIND YOUR FAVOURITE</Text><Text style={styles.sectionTitle}>Browse categories</Text></View>
            <TouchableOpacity style={styles.textLink} onPress={() => { setSelectedCategory(null); setDiet('ALL'); }} accessibilityRole="button" accessibilityLabel="Show all menu items"><Text style={styles.textLinkLabel}>View all</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            <CategoryCard category={{ _id: null, name: 'All items' }} isSelected={!selectedCategory} onPress={() => setSelectedCategory(null)} />
            {categories.map((category) => <CategoryCard key={category._id} category={category} isSelected={selectedCategory === category._id} onPress={() => setSelectedCategory(category._id)} />)}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionEyebrow}>NEWEST ADDITIONS</Text><Text style={styles.sectionTitle}>Fresh on the menu</Text></View>
          </View>
          {error ? <ErrorState onRetry={handleRefresh} retrying={refreshing} /> : loading && !refreshing ? <ProductListSkeleton count={2} /> : featuredProducts.length ? (
            <View style={styles.featuredRow}>
              {featuredProducts.map((product) => (
                <TouchableOpacity key={product._id} onPress={() => router.push(`/product/${product._id}`)} style={styles.featuredCard} accessibilityRole="button" accessibilityLabel={`View ${product.name}`}>
                  {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.featuredImage} resizeMode="cover" /> : <View style={[styles.featuredImage, styles.imageFallback]}><ShoppingBag size={24} color={COLORS.primary} /></View>}
                  <View style={styles.featuredOverlay}><Text style={styles.featuredName} numberOfLines={1}>{product.name}</Text><Text style={styles.featuredPrice}>₹{product.price}</Text></View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {popularProducts.length ? <View style={styles.section}>
          <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>BASED ON PAID ORDERS · LAST 30 DAYS</Text><Text style={styles.sectionTitle}>Popular on campus</Text></View></View>
          <View style={styles.featuredRow}>{popularProducts.map(product => <TouchableOpacity key={product._id} onPress={() => router.push(`/product/${product._id}`)} style={styles.featuredCard} accessibilityRole="button" accessibilityLabel={`Popular item ${product.name}, ${product.totalQuantity} sold in the last 30 days`}>{product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.featuredImage} resizeMode="cover"/> : <View style={[styles.featuredImage, styles.imageFallback]}><ShoppingBag size={24} color={COLORS.primary}/></View>}<View style={styles.featuredOverlay}><View style={{ flex: 1 }}><Text style={styles.featuredName} numberOfLines={1}>{product.name}</Text><Text style={styles.popularCount}>{product.totalQuantity} sold</Text></View><Text style={styles.featuredPrice}>₹{product.price}</Text></View></TouchableOpacity>)}</View>
        </View> : null}

        <View style={styles.menuSection}>
          <View style={styles.menuHeading}>
            <View><Text style={styles.sectionEyebrow}>THE WRAPCHIK MENU</Text><Text style={styles.sectionTitle}>{searchQuery ? 'Search results' : selectedCategory ? 'Your selection' : 'Made for your cravings'}</Text></View>
            <TouchableOpacity style={styles.sortButton} onPress={() => setSortIndex((sortIndex + 1) % SORTS.length)} accessibilityRole="button" accessibilityLabel={`Sort menu. Current: ${sortLabel}`}>
              <ArrowDownUp size={15} color={COLORS.textPrimary} /><Text style={styles.sortText}>{sortLabel}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.filtersRow}>
            <SlidersHorizontal size={15} color={COLORS.textSecondary} />
            {DIET_FILTERS.map((filter) => <TouchableOpacity key={filter.id} onPress={() => setDiet(filter.id)} style={[styles.filterChip, diet === filter.id && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{ selected: diet === filter.id }}><Text style={[styles.filterText, diet === filter.id && styles.filterTextActive]}>{filter.label}</Text></TouchableOpacity>)}
          </View>

          {error ? null : loading && !refreshing ? <ProductListSkeleton /> : products.length === 0 ? (
            <EmptyState title={searchQuery ? 'No matches this time' : 'The menu is quiet right now'} message={searchQuery ? 'Try another dish name or clear your filters.' : 'There are no items in this menu yet. Please check back later.'} buttonTitle={searchQuery || selectedCategory || diet !== 'ALL' ? 'Clear filters' : undefined} onButtonPress={() => { setSearchQuery(''); setSelectedCategory(null); setDiet('ALL'); }} />
          ) : (
            <View style={styles.productList}>{products.map((item) => <View key={item._id} style={[styles.productCell, { width: productCardWidth }]}><ProductCard product={item} onPress={() => router.push(`/product/${item._id}`)} /></View>)}</View>
          )}
        </View>
        <View style={styles.footerNote}><Text style={styles.footerNoteText}>Made fresh for the TIET campus community</Text></View>
      </ScrollView>
      {cartCount > 0 ? <TouchableOpacity style={styles.cartFloating} onPress={() => router.push('/(tabs)/cart')} accessibilityRole="button" accessibilityLabel={`Open cart with ${cartCount} items`}><ShoppingBag size={18} color="#FFFFFF" /><Text style={styles.cartFloatingText}>View cart</Text><View style={styles.cartCount}><Text style={styles.cartCountText}>{cartCount}</Text></View></TouchableOpacity> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 36, maxWidth: THEME.layout.pageMaxWidth, width: '100%', alignSelf: 'center' },
  hero: { paddingHorizontal: THEME.layout.pageGutter, paddingTop: 12, paddingBottom: 20 },
  heroTopline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  locationPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: THEME.radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  locationText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: COLORS.textPrimary },
  timePill: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: THEME.radius.pill, backgroundColor: COLORS.surfaceMuted },
  timeText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 30, lineHeight: 36, fontWeight: '900', maxWidth: 560 },
  heroAccent: { color: COLORS.primary },
  heroSub: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6, maxWidth: 480 },
  searchWrap: { marginHorizontal: 0, marginVertical: 0, marginTop: 18, height: 54, borderRadius: 16, paddingHorizontal: 14, shadowOpacity: 0, elevation: 0 },
  closedBanner: { marginTop: 14, backgroundColor: COLORS.warningLight, padding: 13, borderRadius: 14 },
  closedTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  closedCopy: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  pickupStrip: { marginHorizontal: THEME.layout.pageGutter, padding: 14, backgroundColor: '#FFF2EA', borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 11 },
  pickupIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  pickupCopy: { flex: 1 }, pickupTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary }, pickupSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  section: { marginTop: 27 },
  sectionHeading: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 13 },
  sectionEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4, color: COLORS.primary, marginBottom: 4 },
  sectionTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', color: COLORS.textPrimary },
  textLink: { padding: 8 }, textLinkLabel: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  categoryList: { paddingHorizontal: THEME.layout.pageGutter, paddingBottom: 3 },
  featuredRow: { flexDirection: 'row', paddingHorizontal: THEME.layout.pageGutter, gap: 12 },
  featuredCard: { flex: 1, minWidth: 0, height: 156, borderRadius: 19, overflow: 'hidden', backgroundColor: COLORS.surfaceMuted },
  featuredImage: { width: '100%', height: '100%' }, imageFallback: { alignItems: 'center', justifyContent: 'center' },
  featuredOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 11, backgroundColor: 'rgba(25, 28, 32, 0.78)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  featuredName: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, featuredPrice: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  popularCount: { color: '#F6D5C8', fontSize: 10, fontWeight: '700', marginTop: 2 },
  menuSection: { marginTop: 30 },
  menuHeading: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 38, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: '#FFFFFF' },
  sortText: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary },
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: THEME.layout.pageGutter, marginBottom: 13 },
  filterChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: THEME.radius.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  filterText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary }, filterTextActive: { color: '#FFFFFF' },
  productList: { paddingHorizontal: THEME.layout.pageGutter, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productCell: { minWidth: 0 },
  footerNote: { paddingTop: 20, alignItems: 'center' }, footerNoteText: { fontSize: 11, color: COLORS.textSecondary },
  cartFloating: { position: 'absolute', bottom: 15, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderRadius: 16, paddingHorizontal: 17, backgroundColor: COLORS.primary, shadowColor: '#45251B', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 9, elevation: 5 },
  cartFloatingText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 }, cartCount: { minWidth: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF' }, cartCountText: { color: COLORS.primary, fontSize: 11, fontWeight: '900' },
});
