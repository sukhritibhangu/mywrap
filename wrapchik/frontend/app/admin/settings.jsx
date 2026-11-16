import React, { createElement, useContext, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import api from '../../services/api';
import COLORS from '../../constants/colors';

const ToggleSwitch = ({ value, onValueChange, label }) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={[styles.toggleContainer, value ? styles.toggleOn : styles.toggleOff]}
    >
      <View style={[styles.toggleCircle, value ? styles.circleOn : styles.circleOff]} />
    </TouchableOpacity>
  </View>
);

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const qrFileInput = useRef(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [qrPreviewReady, setQrPreviewReady] = useState(false);
  const [qrPreviewError, setQrPreviewError] = useState(false);
  const [readingQr, setReadingQr] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role !== 'admin') { router.replace('/(auth)/login'); return; }
    fetchSettings();
  }, [authLoading, user?.role]);

  const changeQr = (value) => {
    setQrPreviewReady(false); setQrPreviewError(false);
    setSettings((current) => ({ ...current, upiQrImageUrl: value }));
  };
  const uploadQr = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFeedback('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 512 * 1024) {
      setFeedback('Choose a PNG, JPEG or WebP QR image up to 512 KB.'); setFeedbackError(true); return;
    }
    setReadingQr(true);
    try {
      const value = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The image could not be read. Please select it again.'));
        reader.readAsDataURL(file);
      });
      changeQr(String(value));
      setFeedback('QR selected. Check the preview and recipient, then save settings.'); setFeedbackError(false);
    } catch (error) { setFeedback(error.message); setFeedbackError(true); }
    finally { setReadingQr(false); }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      if (res && res.settings) {
        setSettings(res.settings);
      }
    } catch (e) {
      console.error('[Admin Settings Fetch Error]:', e);
      Alert.alert('Error', 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (settings?.upiQrImageUrl && (!qrPreviewReady || qrPreviewError)) {
      setFeedback('Wait for the QR preview to load, or replace the image before saving.'); setFeedbackError(true); return;
    }
    try {
      setSaving(true);
      await api.put('/settings', settings);
      setFeedback('Settings saved successfully.'); setFeedbackError(false);
    } catch (e) {
      console.error('[Admin Settings Save Error]:', e);
      setFeedback(e.message || 'Failed to save settings.'); setFeedbackError(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading || user?.role !== 'admin') {
    return <LoadingIndicator message="Loading settings..." />;
  }

  if (!settings) {
    return (
      <View style={styles.container}>
        <Header title="Restaurant Settings" showBack showCart={false} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Failed to load settings.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Restaurant Settings" showBack showCart={false} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!!feedback && <View style={[styles.feedback, feedbackError && styles.feedbackError]}><Text style={[styles.feedbackText, feedbackError && styles.feedbackErrorText]}>{feedback}</Text></View>}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Payments</Text>
          <ToggleSwitch label="Cash at counter enabled" value={settings.cashEnabled !== false} onValueChange={val => setSettings({ ...settings, cashEnabled: val })} />
          <ToggleSwitch label="UPI payment enabled" value={settings.upiEnabled === true} onValueChange={val => setSettings({ ...settings, upiEnabled: val })} />
          <Text style={styles.inputLabel}>Outlet UPI ID</Text>
          <TextInput style={styles.input} value={settings.upiId || ''} onChangeText={val => setSettings({ ...settings, upiId: val })} placeholder="outlet@bank" autoCapitalize="none" />
          <Text style={styles.inputLabel}>Payee name</Text>
          <TextInput style={styles.input} value={settings.upiPayeeName || ''} onChangeText={val => setSettings({ ...settings, upiPayeeName: val })} placeholder="Wrapchik TIET" />
          <Text style={styles.inputLabel}>Outlet UPI QR image</Text>
          {Platform.OS === 'web' ? <>
            {createElement('input', { ref: qrFileInput, type: 'file', accept: 'image/png,image/jpeg,image/webp', onChange: uploadQr, style: { display: 'none' }, 'aria-label': 'Choose outlet UPI QR image' })}
            <Button title={readingQr ? 'Reading image…' : 'Upload or replace QR image'} onPress={() => qrFileInput.current?.click()} disabled={saving || readingQr} variant="outline" />
          </> : null}
          <Text style={styles.paymentHelp}>Upload a PNG, JPEG or WebP image up to 512 KB, or paste an HTTPS image URL. The uploaded image is saved with your settings and survives server restarts.</Text>
          <TextInput accessibilityLabel="UPI QR image URL" style={styles.input} value={settings.upiQrImageUrl?.startsWith('data:') ? '' : settings.upiQrImageUrl || ''} onChangeText={changeQr} placeholder={settings.upiQrImageUrl?.startsWith('data:') ? 'An uploaded QR is selected' : 'https://example.com/outlet-qr.png'} autoCapitalize="none" />
          {settings.upiQrImageUrl ? <View style={styles.qrPreview}>
            <Image key={settings.upiQrImageUrl} source={{ uri: settings.upiQrImageUrl }} style={{ width: '100%', maxWidth: 280, height: 280 }} resizeMode="contain" accessibilityLabel="Preview of customer payment QR" onLoad={() => { setQrPreviewReady(true); setQrPreviewError(false); }} onError={() => { setQrPreviewReady(false); setQrPreviewError(true); }} />
            {qrPreviewError ? <Text style={styles.feedbackErrorText}>The QR image could not load. Replace it before saving.</Text> : null}
            <Button title="Remove preset QR" variant="outline" onPress={() => changeQr('')} disabled={saving} />
          </View> : null}
          <Text style={styles.paymentHelp}>Only administrators can change this QR or payment settings. Scan the preview yourself and confirm it belongs to the outlet and matches the UPI ID and payee name above. Customers must enter the exact order total when using a preset QR. If no preset is saved, Wrapchik generates an order-specific QR from the outlet UPI ID. All payments require administrator receipt verification.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Toggles</Text>
          <ToggleSwitch 
            label="Accepting Orders" 
            value={settings.acceptingOrders} 
            onValueChange={(val) => setSettings({...settings, acceptingOrders: val})} 
          />
          <ToggleSwitch 
            label="Delivery Enabled" 
            value={settings.deliveryEnabled} 
            onValueChange={(val) => setSettings({...settings, deliveryEnabled: val})} 
          />
          <ToggleSwitch 
            label="Takeaway Enabled" 
            value={settings.takeawayEnabled} 
            onValueChange={(val) => setSettings({...settings, takeawayEnabled: val})} 
          />
          <ToggleSwitch 
            label="Dine-in Enabled" 
            value={settings.dineInEnabled} 
            onValueChange={(val) => setSettings({...settings, dineInEnabled: val})} 
          />
          <ToggleSwitch label="Scheduled pickup enabled" value={settings.scheduledPickupEnabled === true} onValueChange={val => setSettings({ ...settings, scheduledPickupEnabled: val })} />
          {settings.scheduledPickupEnabled ? <>
            <Text style={styles.inputLabel}>Pickup slot interval (minutes)</Text>
            <View style={styles.statusRow}>{[15, 30, 60].map(value => <TouchableOpacity key={value} onPress={() => setSettings({ ...settings, pickupSlotMinutes: value })} style={[styles.statusBtn, Number(settings.pickupSlotMinutes) === value && styles.statusBtnActive]}><Text style={[styles.statusBtnText, Number(settings.pickupSlotMinutes) === value && styles.statusBtnTextActive]}>{value}</Text></TouchableOpacity>)}</View>
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Orders per pickup slot</Text>
            <TextInput style={styles.input} value={String(settings.pickupSlotCapacity ?? 4)} onChangeText={val => setSettings({ ...settings, pickupSlotCapacity: val === '' ? '' : Number(val) })} keyboardType="number-pad" />
          </> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Info</Text>
          <Text style={styles.inputLabel}>Open Time</Text>
          <TextInput
            style={styles.input}
            value={settings.openTime}
            onChangeText={(val) => setSettings({...settings, openTime: val})}
            placeholder="09:00 (24-hour time)"
          />
          
          <Text style={styles.inputLabel}>Close Time</Text>
          <TextInput
            style={styles.input}
            value={settings.closeTime}
            onChangeText={(val) => setSettings({...settings, closeTime: val})}
            placeholder="23:00 (24-hour time)"
          />

          <Text style={styles.inputLabel}>Est. Prep Minutes</Text>
          <TextInput
            style={styles.input}
            value={settings.estimatedPrepMinutes?.toString()}
            onChangeText={(val) => setSettings({...settings, estimatedPrepMinutes: val === '' ? '' : Number(val)})}
            keyboardType="number-pad"
          />
          
          <Text style={styles.inputLabel}>Delivery Fee (₹)</Text>
          <TextInput
            style={styles.input}
            value={settings.deliveryFee?.toString()}
            onChangeText={(val) => setSettings({...settings, deliveryFee: val === '' ? '' : Number(val)})}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Busy Status</Text>
          <View style={styles.statusRow}>
            {['NORMAL', 'BUSY', 'VERY_BUSY'].map(status => (
              <TouchableOpacity
                key={status}
                onPress={() => setSettings({...settings, busyStatus: status})}
                style={[styles.statusBtn, settings.busyStatus === status && styles.statusBtnActive]}
              >
                <Text style={[styles.statusBtnText, settings.busyStatus === status && styles.statusBtnTextActive]}>
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button 
          title={saving ? "Saving..." : "Save Settings"} 
          onPress={handleSave} 
          disabled={saving}
          style={styles.saveBtn}
        />
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 16 },
  paymentHelp: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: -8 },
  
  // Toggle Styles
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  toggleLabel: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  toggleContainer: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: COLORS.success },
  toggleOff: { backgroundColor: COLORS.border },
  toggleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  circleOn: { transform: [{ translateX: 22 }] },
  circleOff: { transform: [{ translateX: 0 }] },

  // Input Styles
  inputLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, fontWeight: '600' },
  qrPreview: { alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, gap: 12, marginBottom: 16 },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    color: COLORS.textPrimary,
  },

  // Busy Status Styles
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
  },
  statusBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  statusBtnTextActive: { color: '#FFF' },

  saveBtn: { marginTop: 10 },
  feedback: { padding: 11, borderRadius: 8, backgroundColor: '#E6F4E9', marginBottom: 12 }, feedbackError: { backgroundColor: '#FCEBE8' }, feedbackText: { color: '#236C3A', fontSize: 12, fontWeight: '700' }, feedbackErrorText: { color: '#97372B' },
});
