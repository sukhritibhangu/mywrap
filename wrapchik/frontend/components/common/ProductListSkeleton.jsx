import React from 'react';
import { View, StyleSheet } from 'react-native';
import COLORS from '../../constants/colors';

function ProductSkeleton() {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.image} />
      <View style={styles.content}>
        <View style={[styles.line, styles.name]} />
        <View style={[styles.line, styles.description]} />
        <View style={styles.footer}><View style={[styles.line, styles.price]} /><View style={styles.add} /></View>
      </View>
    </View>
  );
}

export default function ProductListSkeleton({ count = 3 }) {
  return <View accessibilityLabel="Loading menu items" accessibilityRole="progressbar">{Array.from({ length: count }, (_, i) => <ProductSkeleton key={i} />)}</View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', padding: 12, marginBottom: 12, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
  image: { width: 94, height: 94, borderRadius: 13, backgroundColor: '#EEEAE4' },
  content: { flex: 1, marginLeft: 14, justifyContent: 'space-between', paddingVertical: 3 },
  line: { backgroundColor: '#EEEAE4', borderRadius: 6 },
  name: { height: 16, width: '70%' }, description: { height: 28, width: '92%' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { height: 16, width: 48 }, add: { height: 32, width: 68, borderRadius: 10, backgroundColor: '#FBE9E7' },
});
