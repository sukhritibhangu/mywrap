import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import authService from '../../services/authService';
import COLORS from '../../constants/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  const sendCode = async () => {
    setError('');
    setNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (resendSeconds > 0) return;
    setBusy(true);
    try {
      const result = await authService.requestPasswordResetOtp(email.trim().toLowerCase());
      if (!result?.success) throw new Error(result?.message || 'A recovery code could not be requested.');
      setOtpSent(true);
      setDevelopmentCode(result.developmentCode || '');
      setResendSeconds(Number(result.resendAfterSeconds) || 60);
      setExpirySeconds(Number(result.expiresInSeconds) || 600);
      setNotice(result.message || 'If an account matches this email, a recovery code has been sent.');
    } catch (requestError) {
      setError(requestError.message || 'Could not request a recovery code.');
      if (requestError.status === 429) setResendSeconds(60);
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    setError('');
    setNotice('');
    if (expirySeconds <= 0) return setError('This recovery code has expired. Request a new code.');
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit recovery code.');
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password)) {
      return setError('Use 8–128 characters with at least one letter and one number.');
    }
    if (password !== confirmPassword) return setError('The passwords do not match.');

    setBusy(true);
    try {
      const result = await authService.resetPasswordWithOtp(email.trim().toLowerCase(), code, password);
      if (!result?.success) throw new Error(result?.message || 'The password could not be updated.');
      setComplete(true);
      setDevelopmentCode('');
      setNotice(result.message || 'Password updated. Sign in with your new password.');
    } catch (resetError) {
      setError(resetError.message || 'The password could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/(auth)/login')} style={styles.back}>
          <ArrowLeft size={18} color={COLORS.textPrimary} />
          <Text style={styles.backText}>Back to sign in</Text>
        </TouchableOpacity>
        <View style={styles.card}>
          <View style={styles.icon}><ShieldCheck size={27} color={COLORS.primary} /></View>
          <Text style={styles.eyebrow}>ACCOUNT SECURITY</Text>
          <Text style={styles.title}>{complete ? 'Password updated' : 'Reset your password'}</Text>
          <Text style={styles.subtitle}>
            {complete
              ? 'Your password has been changed. Sign in with your new password.'
              : 'Verify the email linked to your account, then choose a new password.'}
          </Text>

          {complete ? (
            <Button title="Back to sign in" onPress={() => router.replace('/(auth)/login')} style={styles.primaryButton} />
          ) : (
            <>
              <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" editable={!otpSent} />
              {!otpSent ? (
                <Button title="Send recovery code" onPress={sendCode} loading={busy} style={styles.primaryButton} />
              ) : (
                <>
                  <Text style={styles.helper}>If an account matches this email, a recovery code has been sent.</Text>
                  <Text style={styles.expiryText}>{expirySeconds > 0 ? `Code expires in ${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, '0')}` : 'Code expired. Request a new recovery code.'}</Text>
                  <Input label="6-digit recovery code" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" keyboardType="number-pad" maxLength={6} />
                  {__DEV__ && developmentCode ? <Text style={styles.devCode}>LOCAL DEV OTP: {developmentCode}</Text> : null}
                  <Input label="New password" value={password} onChangeText={setPassword} placeholder="8+ characters" secureTextEntry showPasswordToggle />
                  <Input label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat new password" secureTextEntry showPasswordToggle />
                  <Button title="Update password" onPress={submitReset} loading={busy} disabled={expirySeconds <= 0} style={styles.primaryButton} />
                  <TouchableOpacity accessibilityRole="button" onPress={sendCode} disabled={busy || resendSeconds > 0} style={styles.resend}>
                    <Text style={[styles.resendText, resendSeconds > 0 && styles.disabled]}>
                      {busy ? 'Sending…' : resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend recovery code'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {notice ? <Text accessibilityRole="status" style={styles.notice}>{notice}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.securityRow}>
            <ShieldCheck size={15} color={COLORS.success} />
            <Text style={styles.securityText}>One-time code • Password hashed securely</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  content: { padding: 20, paddingTop: 28, paddingBottom: 36, flexGrow: 1, justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginBottom: 12 },
  backText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: '#FFF', borderColor: '#F0E5DE', borderWidth: 1, borderRadius: 22, padding: 22, maxWidth: 560, width: '100%', alignSelf: 'center', shadowColor: '#171717', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  icon: { width: 54, height: 54, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '900', marginTop: 6 },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 22 },
  helper: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  expiryText: { color: COLORS.warning, fontSize: 11, fontWeight: '800', marginBottom: 10 },
  primaryButton: { marginTop: 8 },
  devCode: { color: COLORS.warning, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  resend: { alignItems: 'center', padding: 14, minHeight: 44 },
  resendText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  disabled: { color: COLORS.textSecondary },
  notice: { color: COLORS.success, backgroundColor: COLORS.successLight, padding: 11, borderRadius: 11, marginTop: 12, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, padding: 11, borderRadius: 11, marginTop: 12, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  securityRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  securityText: { color: COLORS.textSecondary, fontSize: 10 },
});
