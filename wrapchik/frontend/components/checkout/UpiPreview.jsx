import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ShieldCheck, AlertTriangle, Lock } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

/**
 * Shown the moment "Pay via UPI" is chosen. The outlet-uploaded QR is displayed
 * immediately together with the payee and UPI ID so students can check it
 * before placing the order. Payment stays admin-verified.
 */
export default function UpiPreview({ settings, amount, estimate = true, confirmed, onConfirm }) {
  const [imageFailed, setImageFailed] = useState(false);
  const qrImage = settings?.upiQrImageUrl;

  useEffect(() => { setImageFailed(false); }, [qrImage]);

  const generatedQrValue = settings?.upiId
    ? `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.upiPayeeName || 'Wrapchik')}&cu=INR`
    : '';

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.lockChip}>
          <Lock size={11} color={COLORS.cocoa} />
          <Text style={styles.lockText}>OUTLET-VERIFIED UPI</Text>
        </View>
        <Text style={styles.amount}>₹{Number(amount || 0).toLocaleString('en-IN')}</Text>
      </View>

      <View style={styles.qrWrap}>
        {qrImage && !imageFailed ? (
          <Image
            source={{ uri: qrImage }}
            style={styles.qrImage}
            resizeMode="contain"
            accessibilityLabel="UPI QR uploaded by the outlet administrator"
            onError={() => setImageFailed(true)}
          />
        ) : generatedQrValue ? (
          <QRCode value={generatedQrValue} size={168} backgroundColor="#FFFFFF" color="#3A2318" />
        ) : (
          <View style={styles.qrPlaceholder}>
            <AlertTriangle size={22} color={COLORS.warning} />
            <Text style={styles.placeholderText}>The outlet QR is not available right now.</Text>
          </View>
        )}
      </View>

      <Text style={styles.scanHint}>
        Scan with any UPI app. Confirm the recipient name and exact amount in your app before paying.
      </Text>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>PAYEE</Text>
        <Text style={styles.detailValue}>{settings?.upiPayeeName || 'Not set by the outlet'}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>UPI ID</Text>
        <Text style={styles.detailValue} selectable>{settings?.upiId || 'Not set by the outlet'}</Text>
      </View>

      {estimate ? (
        <View style={styles.estimateBox}>
          <AlertTriangle size={15} color={COLORS.warning} />
          <View style={styles.estimateCopy}>
            <Text style={styles.estimateTitle}>This amount is still an estimate</Text>
            <Text style={styles.estimateText}>
              Place the order first. The next screen shows the final amount from the outlet — check it and the payee before paying.
            </Text>
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => onConfirm?.(!confirmed)}
        style={[styles.confirmRow, confirmed && styles.confirmRowOn]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: Boolean(confirmed) }}
        accessibilityLabel="I understand the final amount is confirmed after placing the order"
      >
        <View style={[styles.checkbox, confirmed && styles.checkboxOn]}>
          {confirmed ? <ShieldCheck size={14} color="#FFFFFF" /> : null}
        </View>
        <Text style={styles.confirmText}>
          I understand the final amount is confirmed by Wrapchik after I place this order. I will check it before paying.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground, borderRadius: THEME.radius.lg, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, marginTop: 10,
    ...THEME.shadow.soft,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  lockChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.goldLight,
    borderRadius: THEME.radius.pill, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(217,164,65,0.4)',
  },
  lockText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8, color: COLORS.cocoa },
  amount: { fontSize: 22, fontWeight: '900', color: COLORS.primaryDark },
  qrWrap: {
    alignSelf: 'center', marginTop: 14, padding: 10, backgroundColor: '#FFFFFF',
    borderRadius: THEME.radius.md, borderWidth: 1, borderColor: COLORS.border,
  },
  qrImage: { width: 196, height: 196 },
  qrPlaceholder: { width: 196, height: 196, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  placeholderText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 17 },
  scanHint: { fontSize: 11.5, lineHeight: 17, color: COLORS.textSecondary, textAlign: 'center', marginTop: 10 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 2,
  },
  detailLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: COLORS.cocoaMuted, paddingTop: 2 },
  detailValue: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary, flexShrink: 1, textAlign: 'right' },
  estimateBox: {
    flexDirection: 'row', gap: 8, padding: 11, borderRadius: THEME.radius.sm,
    backgroundColor: COLORS.warningLight, marginTop: 12,
  },
  estimateCopy: { flex: 1 },
  estimateTitle: { fontSize: 12, fontWeight: '900', color: COLORS.cocoa },
  estimateText: { fontSize: 11, lineHeight: 16, color: COLORS.textSecondary, marginTop: 2 },
  confirmRow: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 12,
    padding: 11, borderRadius: THEME.radius.sm, borderWidth: 1.5, borderColor: COLORS.border,
  },
  confirmRowOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  checkbox: {
    width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.cocoaMuted,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.parchment, marginTop: 1,
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  confirmText: { flex: 1, fontSize: 11.5, lineHeight: 17, color: COLORS.textPrimary, fontWeight: '600' },
});
