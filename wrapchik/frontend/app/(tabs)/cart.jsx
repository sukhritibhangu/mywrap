import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Trash2, MapPin, Sparkles } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import Header from '../../components/common/Header';
import CartItem from '../../components/cart/CartItem';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

export default function CartScreen() {
  const router = useRouter();
  const { cartItems, cartCount, subtotal, taxAndFees, grandTotal, clearCart } = useContext(CartContext);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const confirmClear = () => Alert.alert('Clear your bag?', 'All items will be removed from this bag.', [
    { text: 'Keep items', style: 'cancel' },
    { text: 'Clear bag', style: 'destructive', onPress: clearCart },
  ]);

  return (
    <View style={styles.container}>
      <Header title="Your bag" showCart={false} />

      {cartItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Your bag is feeling light"
            message="Wrapoo is ready to help you find something warm, cheesy or crispy."
            buttonTitle="Explore the menu"
            onButtonPress={() => router.push('/(tabs)/home')}
          />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.clearHeader}>
            <View>
              <Text style={styles.kicker}>TUCKED IN YOUR BAG</Text>
              <Text style={styles.itemCountText}>{cartCount} {cartCount === 1 ? 'delicious thing' : 'delicious things'}</Text>
            </View>
            <TouchableOpacity onPress={confirmClear} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear bag">
              <Trash2 size={15} color={COLORS.danger} />
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.cartKey}
            renderItem={({ item, index }) => <CartItem item={item} index={index} />}
            contentContainerStyle={styles.listContent}
          />

          <View style={styles.pickupBox}>
            <MapPin size={17} color={COLORS.primaryDark} />
            <Text style={styles.pickupText}>
              Pickup at <Text style={styles.pickupBold}>Wrapchik SAC Counter</Text>. Choose delivery, takeaway or dine-in at checkout.
            </Text>
          </View>

          <View style={styles.billCard}>
            <View style={styles.billTitleRow}>
              <Text style={styles.billTitle}>Your estimate</Text>
              <Sparkles size={14} color={COLORS.gold} />
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item subtotal</Text>
              <Text style={styles.billValue}>₹{subtotal}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Taxes & fees (5%)</Text>
              <Text style={styles.billValue}>₹{taxAndFees}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.billRow}>
              <Text style={styles.grandTotalLabel}>Estimated total</Text>
              <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
            </View>
            <Text style={styles.billNote}>Delivery fees and coupons are applied at checkout. The outlet confirms the final amount when your order is placed.</Text>

            <Button
              title={`Continue · ₹${grandTotal}`}
              loading={checkoutBusy}
              onPress={() => { if (!checkoutBusy) { setCheckoutBusy(true); router.push('/checkout'); setTimeout(() => setCheckoutBusy(false), 1200); } }}
              style={styles.checkoutBtn}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  content: { flex: 1, maxWidth: 760, width: '100%', alignSelf: 'center' },
  clearHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  kicker: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.4, color: COLORS.goldDeep, marginBottom: 3 },
  itemCountText: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 8 },
  clearText: { fontSize: 12.5, fontWeight: '800', color: COLORS.danger },
  listContent: { paddingHorizontal: 16 },
  pickupBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight,
    padding: 13, marginHorizontal: 16, borderRadius: THEME.radius.md, gap: 8, marginVertical: 8,
    borderWidth: 1, borderColor: 'rgba(242,96,31,0.15)',
  },
  pickupText: { fontSize: 12.5, color: COLORS.textPrimary, flex: 1, lineHeight: 18 },
  pickupBold: { fontWeight: '900', color: COLORS.primaryDark },
  billCard: {
    backgroundColor: COLORS.cardBackground, padding: 18, borderTopLeftRadius: THEME.radius.xl,
    borderTopRightRadius: THEME.radius.xl, borderWidth: 1, borderColor: COLORS.border,
    maxWidth: 760, width: '100%', alignSelf: 'center', ...THEME.shadow.soft,
  },
  billTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  billTitle: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  billLabel: { fontSize: 13, color: COLORS.textSecondary },
  billValue: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 9 },
  grandTotalLabel: { fontSize: 16, fontWeight: '900', color: COLORS.textPrimary },
  grandTotalValue: { fontSize: 20, fontWeight: '900', color: COLORS.primaryDark },
  billNote: { fontSize: 10.5, lineHeight: 16, color: COLORS.cocoaMuted, marginTop: 6 },
  checkoutBtn: { marginTop: 14 },
});
