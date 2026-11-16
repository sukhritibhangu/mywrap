import React, { createElement, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import authService from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import COLORS from '../../constants/colors';

let googleScriptPromise;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      const timer = setTimeout(() => { script.remove(); googleScriptPromise = null; reject(new Error('Google sign-in took too long to load. Try again.')); }, 15000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); googleScriptPromise = null; reject(new Error('Google sign-in could not load. Check your connection and try again.')); };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

function GoogleButton({ onCredential, onError }) {
  const element = useRef(null);
  const credentialCallback = useRef(onCredential);
  credentialCallback.current = onCredential;
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') { setLoading(false); return undefined; }
    let active = true;
    (async () => {
      try {
        const config = await authService.googleConfig();
        if (!config.enabled) { if (active) setUnavailable(true); return; }
        const [challenge] = await Promise.all([authService.googleChallenge(), loadGoogleScript()]);
        if (!active || !element.current) return;
        window.google.accounts.id.initialize({
          client_id: config.clientId, hd: 'thapar.edu', nonce: challenge.nonce,
          auto_select: false, ux_mode: 'popup',
          callback: (response) => {
            if (active && response.credential) credentialCallback.current(response.credential, challenge.challengeId);
          },
        });
        window.google.accounts.id.renderButton(element.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', width: 300 });
      } catch (error) { if (active) onError(error.message || 'Google sign-in could not load. Try again.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  if (Platform.OS !== 'web') return <Button title="Open Wrapchik web sign-in" onPress={() => Linking.openURL('https://wrapchik.onrender.com/login')} />;
  return <View style={styles.googleButton}>
    {loading ? <View style={{ alignItems: 'center', gap: 10 }}><ActivityIndicator color={COLORS.primary} accessibilityLabel="Loading Google sign-in" /><Text style={styles.domain}>Connecting to sign-in… This may take a minute.</Text></View> : null}
    {unavailable ? <Text style={styles.info}>Google sign-in will be available soon. Please try again later.</Text> : null}
    {createElement('div', { ref: element, style: { minHeight: loading || unavailable ? 0 : 44, maxWidth: '100%' } })}
  </View>;
}

export default function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const { login, loginWithGoogle, isLoading } = useContext(AuthContext);
  const [adminMode, setAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [pendingGoogle, setPendingGoogle] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const googleBusy = useRef(false);
  const goHome = (user) => {
    if (user?.role === 'admin') return router.replace('/admin/dashboard');
    const routes = { checkout: '/checkout', orders: '/(tabs)/orders', favourites: '/favourites', notifications: '/notifications' };
    router.replace(typeof returnTo === 'string' && routes[returnTo] ? routes[returnTo] : '/(tabs)/home');
  };
  const handleGoogle = async (credential, challengeId, mobile) => {
    if (googleBusy.current) return;
    googleBusy.current = true;
    setError('');
    try {
      const result = await loginWithGoogle(credential, challengeId, mobile);
      if (!result.success) setError(result.message || 'Google sign-in failed. Try again.');
      else if (result.requiresPhone) setPendingGoogle({ credential, challengeId, email: result.email, name: result.name });
      else goHome(result.user);
    } finally { googleBusy.current = false; }
  };
  const restartGoogle = () => { setPendingGoogle(null); setPhone(''); setError(''); setAttempt((value) => value + 1); };
  const handleAdmin = async () => {
    setError('');
    if (!email.trim() || !password) return setError('Enter your admin email and password.');
    const result = await login(email.trim().toLowerCase(), password);
    if (result.success) goHome(result.user);
    else setError(result.message || 'Invalid email or password.');
  };
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.logo}><Text style={styles.logoText}>W</Text></View>
        <Text style={styles.brand}>WRAPCHIK</Text>
        <Text style={styles.tagline}>Campus cravings. One tap away. 🌯</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>{adminMode ? 'Admin sign in' : pendingGoogle ? 'One last thing' : 'Welcome to Wrapchik'}</Text>
        <Text style={styles.subtitle}>{adminMode ? 'Use your existing admin email and password.' : pendingGoogle ? 'Add a phone number so the outlet can reach you about your order.' : 'Sign in or create an account with your Thapar Google account.'}</Text>
        {adminMode ? <>
          <Input label="Admin email" value={email} onChangeText={setEmail} placeholder="Admin email address" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry showPasswordToggle />
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgot}><Text style={styles.link}>Forgot password?</Text></TouchableOpacity>
          <Button title="Sign In as Admin" onPress={handleAdmin} loading={isLoading} />
        </> : pendingGoogle ? <>
          <Text style={styles.info}>{pendingGoogle.name} · {pendingGoogle.email}</Text>
          <Input label="Phone number" value={phone} onChangeText={setPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" />
          <Button title="Complete signup" loading={isLoading} onPress={() => {
            if (!phone.trim()) return setError('Enter your phone number.');
            handleGoogle(pendingGoogle.credential, pendingGoogle.challengeId, phone.trim());
          }} />
          <TouchableOpacity accessibilityRole="button" onPress={restartGoogle} style={styles.retry}><Text style={styles.link}>Use a different Google account</Text></TouchableOpacity>
        </> : <>
          <GoogleButton key={attempt} onCredential={handleGoogle} onError={setError} />
          <Text style={styles.domain}>Only @thapar.edu Google accounts are accepted.</Text>
          {isLoading ? <ActivityIndicator color={COLORS.primary} accessibilityLabel="Signing in" /> : null}
        </>}
        {error ? <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          {!adminMode ? <TouchableOpacity accessibilityRole="button" onPress={restartGoogle}><Text style={styles.link}>Try Google again</Text></TouchableOpacity> : null}
        </View> : null}
        <View style={styles.security}><ShieldCheck size={17} color={COLORS.success} /><Text style={styles.securityText}>Secure sign-in • Your orders stay with your account</Text></View>
      </View>
      <TouchableOpacity accessibilityRole="button" style={styles.footer} onPress={() => { setAdminMode((value) => !value); restartGoogle(); setPassword(''); }}>
        <Text style={styles.link}>{adminMode ? 'Back to student sign in' : 'Admin sign in'}</Text>
      </TouchableOpacity>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  scroll: { padding: 22, paddingVertical: 36, width: '100%', maxWidth: 560, alignSelf: 'center', flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 62, height: 62, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  logoText: { color: '#FFF', fontSize: 34, fontWeight: '900' },
  brand: { marginTop: 12, color: COLORS.textPrimary, fontSize: 23, fontWeight: '900', letterSpacing: 2 },
  tagline: { marginTop: 5, color: COLORS.textSecondary, fontSize: 13 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#F0E5DE', width: '100%' },
  title: { fontSize: 25, fontWeight: '900', color: COLORS.textPrimary },
  subtitle: { fontSize: 14, lineHeight: 21, color: COLORS.textSecondary, marginTop: 6, marginBottom: 22 },
  googleButton: { alignItems: 'center', minHeight: 48, justifyContent: 'center', width: '100%' },
  domain: { textAlign: 'center', fontSize: 12, lineHeight: 18, color: COLORS.textSecondary, marginVertical: 14 },
  info: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  link: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 8, marginTop: -6, marginBottom: 10 },
  retry: { alignItems: 'center', padding: 14 },
  errorBox: { backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 12, marginTop: 14, gap: 10 },
  error: { color: COLORS.danger, fontSize: 13, lineHeight: 19 },
  security: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 22 },
  securityText: { color: COLORS.textSecondary, fontSize: 11, flexShrink: 1 },
  footer: { alignItems: 'center', padding: 18, marginTop: 4 },
});
