import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldCheck, Mail, LockKeyhole } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import authService from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import COLORS from '../../constants/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const { login, verifyOtp, isLoading } = useContext(AuthContext);
  const [mode, setMode] = useState('PASSWORD');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState('');
  const [busyOtp, setBusyOtp] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(0);
  const [error, setError] = useState('');

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

  const goHome = (user) => {
    if (user?.role === 'admin') return router.replace('/admin/dashboard');
    const returnRoutes = {
      checkout: '/checkout',
      orders: '/(tabs)/orders',
      favourites: '/favourites',
      notifications: '/notifications',
    };
    if (typeof returnTo === 'string' && returnRoutes[returnTo]) return router.replace(returnRoutes[returnTo]);
    return router.replace('/(tabs)/home');
  };

  const handlePasswordLogin = async () => {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) return setError('Enter a valid email and your password.');
    const res = await login(email.trim().toLowerCase(), password);
    if (res.success) goHome(res.user);
    else setError(res.message || 'Invalid credentials');
  };

  const handleSendOtp = async () => {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    setBusyOtp(true);
    try {
      const res = await authService.requestOtp(email.trim().toLowerCase());
      if (res.success) {
        setOtpSent(true);
        setDevelopmentCode(res.developmentCode || '');
        setResendSeconds(res.resendAfterSeconds || 60);
        setExpirySeconds(res.expiresInSeconds || 600);
      } else {
        setOtpSent(false);
        setDevelopmentCode('');
        setError(res.message || 'A code was not sent. Check the email address and try again.');
      }
    } catch (e) {
      setError(e.message || 'Could not send OTP');
      if (e.status === 429) setResendSeconds(60);
    }
    finally { setBusyOtp(false); }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (expirySeconds <= 0) return setError('This code has expired. Request a new OTP.');
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit OTP.');
    const res = await verifyOtp(email.trim().toLowerCase(), otp, 'LOGIN');
    if (res.success) goHome(res.user);
    else setError(res.message || 'Invalid OTP');
  };


  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logo}><Text style={styles.logoText}>W</Text></View>
          <Text style={styles.brand}>WRAPCHIK</Text>
          <Text style={styles.tagline}>Campus cravings. One tap away. 🌯</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Choose how you want to sign in.</Text>

          <View style={styles.modeTabs}>
            <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: mode === 'PASSWORD' }} style={[styles.modeTab, mode === 'PASSWORD' && styles.modeTabActive]} onPress={() => { setMode('PASSWORD'); setError(''); }}>
              <LockKeyhole size={17} color={mode === 'PASSWORD' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.modeText, mode === 'PASSWORD' && styles.modeTextActive]}>Password</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: mode === 'OTP' }} style={[styles.modeTab, mode === 'OTP' && styles.modeTabActive]} onPress={() => { setMode('OTP'); setError(''); }}>
              <Mail size={17} color={mode === 'OTP' ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.modeText, mode === 'OTP' && styles.modeTextActive]}>Email OTP</Text>
            </TouchableOpacity>
          </View>

          {mode === 'PASSWORD' ? (
            <>
              <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
              <Input label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry showPasswordToggle />
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotLink}>
                <Text style={styles.changeLink}>Forgot password?</Text>
              </TouchableOpacity>
              <Button title="Sign In" onPress={handlePasswordLogin} loading={isLoading} style={styles.mainButton} />
            </>
          ) : (
            <>
              <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
              {!otpSent ? (
                <Button title="Send OTP" onPress={handleSendOtp} loading={busyOtp} style={styles.mainButton} />
              ) : (
                <>
                  <View style={styles.otpHeader}>
                    <Text style={styles.otpInfo}>{developmentCode ? `Local development code for ${email}` : `If an account matches ${email}, a code may be sent.`}</Text>
                    <TouchableOpacity accessibilityRole="button" onPress={() => { setOtpSent(false); setOtp(''); setExpirySeconds(0); setDevelopmentCode(''); }}><Text style={styles.changeLink}>Change</Text></TouchableOpacity>
                  </View>
                  <Text style={styles.expiryText}>{expirySeconds > 0 ? `Code expires in ${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, '0')}` : 'Code expired. Request a new OTP.'}</Text>
                  <Input label="6-digit OTP" value={otp} onChangeText={setOtp} placeholder="123456" keyboardType="number-pad" />
                  {__DEV__ && developmentCode ? <Text style={styles.devOtp}>LOCAL DEV OTP: {developmentCode}</Text> : null}
                  <Button title="Verify & Sign In" onPress={handleVerifyOtp} loading={isLoading} disabled={expirySeconds <= 0} style={styles.mainButton} />
                  <TouchableOpacity onPress={handleSendOtp} disabled={busyOtp || resendSeconds > 0} accessibilityRole="button" accessibilityState={{ disabled: busyOtp || resendSeconds > 0 }} style={styles.resend}>
                    <Text style={[styles.resendText, resendSeconds > 0 && styles.resendDisabled]}>{busyOtp ? 'Sending…' : resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : 'Resend OTP'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {error ? <Text style={styles.error}>⚠ {error}</Text> : null}

          <View style={styles.securityRow}>
            <ShieldCheck size={17} color={COLORS.success} />
            <Text style={styles.securityText}>Encrypted session • Protected authentication</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Wrapchik?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}><Text style={styles.link}> Create account</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  scrollContent: { padding: 22, paddingTop: 36, paddingBottom: 36, width: '100%', maxWidth: 560, alignSelf: 'center', flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 62, height: 62, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  logoText: { color: '#FFF', fontSize: 34, fontWeight: '900' },
  brand: { marginTop: 12, color: COLORS.textPrimary, fontSize: 23, fontWeight: '900', letterSpacing: 2 },
  tagline: { marginTop: 5, color: COLORS.textSecondary, fontSize: 13 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#F0E5DE', elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, width: '100%' },
  title: { fontSize: 25, fontWeight: '900', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 18 },
  modeTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE7E2', marginBottom: 18, gap: 18 },
  modeTab: { flex: 1, flexDirection: 'row', height: 46, alignItems: 'center', justifyContent: 'center', gap: 7, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  modeTabActive: { borderBottomColor: COLORS.primary },
  modeText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  modeTextActive: { color: COLORS.primary },
  mainButton: { marginTop: 4 },
  otpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  otpInfo: { fontSize: 12, color: COLORS.textSecondary },
  expiryText: { fontSize: 11, fontWeight: '700', color: COLORS.warning, marginBottom: 10 },
  changeLink: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: 8, marginTop: -6, marginBottom: 6 },
  devOtp: { textAlign: 'center', color: COLORS.warning, fontWeight: '800', marginBottom: 10 },
  resend: { alignItems: 'center', padding: 12 },
  resendText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  resendDisabled: { color: COLORS.textSecondary },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 10, marginTop: 12, fontSize: 12, fontWeight: '700' },
  securityRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 18 },
  securityText: { color: COLORS.textSecondary, fontSize: 11 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: COLORS.textSecondary, fontSize: 13 },
  link: { color: COLORS.primary, fontWeight: '900', fontSize: 13 },
});
