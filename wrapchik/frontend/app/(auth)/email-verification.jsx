import React, { useContext, useEffect, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import authService from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import COLORS from '../../constants/colors';

export default function EmailVerificationScreen() {
  const router = useRouter();
  const { email: routeEmail, purpose: routePurpose, resendAfterSeconds: initialResend, expiresInSeconds: initialExpiry } = useLocalSearchParams();
  const email = String(routeEmail || '').trim().toLowerCase();
  const purpose = String(routePurpose || 'EMAIL_VERIFY');
  const { verifyOtp, isLoading, developmentOtp, clearDevelopmentOtp } = useContext(AuthContext);
  const [code, setCode] = useState('');
  const [developmentCode, setDevelopmentCode] = useState(developmentOtp || '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(Number(initialResend) || 60);
  const [expirySeconds, setExpirySeconds] = useState(Number(initialExpiry) || 600);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (expirySeconds <= 0) return undefined;
    const timer = setTimeout(() => setExpirySeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [expirySeconds]);

  const verify = async () => {
    setError('');
    if (expirySeconds <= 0) return setError('This code has expired. Request a new code.');
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code.');
    const result = await verifyOtp(email, code, purpose);
    if (result.success) {
      clearDevelopmentOtp();
      router.replace('/(tabs)/home');
    } else setError(result.message || 'The code could not be verified.');
  };

  const resend = async () => {
    setError('');
    setNotice('');
    if (busy || resendSeconds > 0) return;
    setBusy(true);
    try {
      const result = await authService.requestOtp(email, purpose);
      if (!result?.success) throw new Error(result?.message || 'A new code could not be requested.');
      setDevelopmentCode(result.developmentCode || '');
      clearDevelopmentOtp();
      setCode('');
      setResendSeconds(Number(result.resendAfterSeconds) || 60);
      setExpirySeconds(Number(result.expiresInSeconds) || 600);
      setNotice(result.message || 'Check your email for a new code.');
    } catch (requestError) {
      setError(requestError.message || 'Could not send a code.');
      if (requestError.status === 429) setResendSeconds(60);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.icon}><MailCheck size={32} color={COLORS.primary} /></View>
      <Text style={styles.title}>{purpose === 'SIGNUP' ? 'Verify your student email' : 'Verify your email'}</Text>
      <Text style={styles.subtitle}>{purpose === 'SIGNUP' ? `Enter the six-digit code sent to ${email} to finish creating your account.` : `If an account matches this email, check ${email} for a six-digit code.`}</Text>
      <Text style={styles.expiry}>{expirySeconds > 0 ? `Code expires in ${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, '0')}` : 'Code expired. Request a new one.'}</Text>
      <Input label="6-digit verification code" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" keyboardType="number-pad" maxLength={6} accessibilityLabel="6-digit verification code" />
      {__DEV__ && developmentCode ? <Text style={styles.devCode}>LOCAL DEV OTP: {developmentCode}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text accessibilityRole="status" style={styles.notice}>{notice}</Text> : null}
      <Button title="Verify & Create Account" onPress={verify} loading={isLoading} disabled={expirySeconds <= 0} />
      <TouchableOpacity accessibilityRole="button" onPress={resend} disabled={busy || resendSeconds > 0} style={styles.resend}>
        <Text style={[styles.resendText, resendSeconds > 0 && styles.disabled]}>{busy ? 'Sending…' : resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.replace(purpose === 'SIGNUP' ? '/(auth)/signup' : '/(auth)/login')}><Text style={styles.back}>{purpose === 'SIGNUP' ? 'Back to registration' : 'Back to sign in'}</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3', padding: 24, justifyContent: 'center' },
  icon: { width: 68, height: 68, borderRadius: 22, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, lineHeight: 19, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 22 },
  expiry: { color: COLORS.warning, fontSize: 12, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  devCode: { color: COLORS.warning, textAlign: 'center', fontWeight: '800', marginBottom: 12 },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 12, fontWeight: '700' },
  notice: { color: COLORS.success, textAlign: 'center', marginBottom: 12, fontSize: 12, fontWeight: '700' },
  resend: { alignItems: 'center', padding: 14 },
  resendText: { color: COLORS.primary, fontWeight: '800' },
  disabled: { color: COLORS.textSecondary },
  back: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 8, fontSize: 12 },
});
