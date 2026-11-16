import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ShoppingBag, HelpCircle, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Header from '../components/common/Header';
import COLORS from '../constants/colors';

const FAQS = [
  {
    q: 'How do I place an order?',
    a: 'Browse the live menu, choose any available customizations, add items to your cart, and select an enabled fulfillment and payment option at checkout.',
  },
  {
    q: 'Where do I pickup my food order?',
    a: 'Collect your order from the Wrapchik Counter located at the SAC Ground Floor once your order status changes to "Ready for Pickup".',
  },
  {
    q: 'What payment methods are supported?',
    a: 'Choose cash at the counter or UPI at checkout. UPI shows a QR with the server-calculated order total; submit the transaction reference after paying. The outlet verifies receipt manually before the order is marked paid.',
  },
  {
    q: 'What if my payment fails?',
    a: 'Check the payment status on your order and contact the outlet if a payment was debited but the order still shows pending. UPI claims are reviewed manually by outlet staff.',
  },
];

export default function SupportScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Header title="Help & Support" showBack showCart={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order support entry point */}
        <TouchableOpacity onPress={() => router.push('/(tabs)/orders')} style={styles.supportLink} accessibilityRole="button">
          <View style={styles.supportIcon}><ShoppingBag size={21} color={COLORS.primary} /></View>
          <View style={styles.supportLinkCopy}><Text style={styles.contactTitle}>Need help with an order?</Text><Text style={styles.contactVal}>Open your orders to view status or report an issue.</Text></View>
          <ChevronRight size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* FAQs */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        {FAQS.map((faq, idx) => (
          <View key={idx} style={styles.faqCard}>
            <View style={styles.questionRow}>
              <HelpCircle size={18} color={COLORS.primary} />
              <Text style={styles.questionText}>{faq.q}</Text>
            </View>
            <Text style={styles.answerText}>{faq.a}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 8,
    marginBottom: 12,
  },
  supportLink: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14, marginBottom: 22 },
  supportIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight },
  supportLinkCopy: { flex: 1 },
  contactTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  contactVal: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  answerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginLeft: 26,
  },
});
