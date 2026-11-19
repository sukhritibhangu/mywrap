import React, { createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldCheck, Sparkles, Volume2 } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import authService from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';
import Wrapoo from '../../components/wrapoo/Wrapoo';
import { useCompanion } from '../../context/CompanionContext';
import useReducedMotion from '../../hooks/useReducedMotion';

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

const RAPO_LINES = {
  signin: {
    bubble: "Hey there! I'm Rapo! Welcome to Wrapchik! 🍔\nBeen here before? Let's get you signed in!",
    speech: "Hey there! I'm Rapo! Welcome to Wrapchik! Been here before? Let's get you signed in!",
    title: 'Welcome back',
    subtitle: 'Sign in with your Thapar Google account to see your menu, bag and live orders.',
  },
  signup: {
    bubble: "New to Wrapchik? Let's create your account and get something delicious! 🥙",
    speech: "New to Wrapchik? Let's create your account and get something delicious!",
    title: 'Create your account',
    subtitle: 'One tap with your @thapar.edu Google account creates your Wrapchik profile.',
  },
  admin: {
    bubble: 'Admin console ahead. Sign in with your Wrapchik admin email and password.',
    speech: 'Admin console ahead. Sign in with your Wrapchik admin email and password.',
    title: 'Admin sign in',
    subtitle: 'Use your existing admin email and password.',
  },
};

export default function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const { login, loginDemoAdmin, loginWithGoogle, isLoading } = useContext(AuthContext);
  const { speak, speaking } = useCompanion();
  const reducedMotion = useReducedMotion();
  const [adminMode, setAdminMode] = useState(false);
  const [mode, setMode] = useState('signin');
  const [demoAvailable, setDemoAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [pendingGoogle, setPendingGoogle] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const googleBusy = useRef(false);
  const bubbleIn = useRef(new Animated.Value(1)).current;

  const copy = useMemo(() => (adminMode ? RAPO_LINES.admin : RAPO_LINES[mode]), [adminMode, mode]);

  useEffect(() => {
    if (!adminMode) { setDemoAvailable(false); return undefined; }
    let active = true;
    authService.demoAdminStatus()
      .then((result) => { if (active) setDemoAvailable(Boolean(result?.enabled)); })
      .catch(() => { if (active) setDemoAvailable(false); });
    return () => { active = false; };
  }, [adminMode]);

  // A gentle swap of Rapo's line whenever the mode changes.
  useEffect(() => {
    if (reducedMotion) { bubbleIn.setValue(1); return; }
    bubbleIn.setValue(0);
    Animated.timing(bubbleIn, {
      toValue: 1, duration: 260, easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [bubbleIn, copy, reducedMotion]);

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
  const handleDemoAdmin = async () => {
    setError('');
    const result = await loginDemoAdmin();
    if (result.success) goHome(result.user);
    else setError(result.message || 'Demo admin is unavailable. Check the backend setup.');
  };

  const hearRapo = useCallback(() => {
    speak(copy.speech, { mood: 'talking' });
  }, [copy.speech, speak]);

  const switchMode = (next) => {
    setError('');
    setMode(next);
  };

  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>WELCOME TO WRAPCHIK</Text>
        <Text style={styles.brand}>WRAPCHIK</Text>
      </View>

      <View style={styles.rapoRow}>
        <View style={styles.mascotWrap}>
          <Wrapoo
            size={92}
            mood={speaking ? 'talking' : 'happy'}
            onPress={hearRapo}
            onPressHat={hearRapo}
          />
        </View>
        <Animated.View style={[styles.bubble, { opacity: bubbleIn, transform: [{ translateX: bubbleIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
          <Text style={styles.bubbleText}>{copy.bubble}</Text>
          <TouchableOpacity onPress={hearRapo} style={styles.bubbleHear} accessibilityRole="button" accessibilityLabel="Hear Rapo's greeting">
            <Volume2 size={12} color={COLORS.cocoaSoft} />
            <Text style={styles.bubbleHearText}>{speaking ? 'Rapo is talking…' : 'Tap me to hear it'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={styles.card}>
        {!adminMode && !pendingGoogle ? (
          <View style={styles.modeSwitch} accessibilityRole="tablist">
            {[{ id: 'signin', label: 'Sign In' }, { id: 'signup', label: 'Create Account' }].map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => switchMode(option.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === option.id }}
                style={[styles.modeTab, mode === option.id && styles.modeTabActive]}
              >
                <Text style={[styles.modeTabText, mode === option.id && styles.modeTabTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text style={styles.title}>{pendingGoogle ? 'One last thing' : copy.title}</Text>
        <Text style={styles.subtitle}>
          {pendingGoogle ? 'Add a phone number so the outlet can reach you about your order.' : copy.subtitle}
        </Text>

        {adminMode ? <>
          <Input label="Admin email" value={email} onChangeText={setEmail} placeholder="Admin email address" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry showPasswordToggle />
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgot}><Text style={styles.link}>Forgot password?</Text></TouchableOpacity>
          <Button title="Sign In as Admin" onPress={handleAdmin} loading={isLoading} />
          {demoAvailable ? (
            <View style={styles.demoBox}>
              <Text style={styles.demoKicker}>LOCAL DEVELOPMENT DEMO</Text>
              <Text style={styles.demoNote}>One-click admin access for local reviews. Disabled outside development; never use it for real orders.</Text>
              <Button title="Enter demo admin" variant="outline" onPress={handleDemoAdmin} disabled={isLoading} />
            </View>
          ) : null}
        </> : pendingGoogle ? <>
          <Text style={styles.info}>{pendingGoogle.name} · {pendingGoogle.email}</Text>
          <Input label="Phone number" value={phone} onChangeText={setPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" />
          <Button title="Complete signup" loading={isLoading} onPress={() => {
            if (!phone.trim()) return setError('Enter your phone number.');
            handleGoogle(pendingGoogle.credential, pendingGoogle.challengeId, phone.trim());
          }} />
          <TouchableOpacity accessibilityRole="button" onPress={restartGoogle} style={styles.retry}><Text style={styles.link}>Use a different Google account</Text></TouchableOpacity>
        </> : <>
          <GoogleButton key={`${attempt}-${mode}`} onCredential={handleGoogle} onError={setError} />
          <Text style={styles.domain}>Only @thapar.edu Google accounts are accepted.</Text>
          {isLoading ? <ActivityIndicator color={COLORS.primary} accessibilityLabel="Signing in" /> : null}
          {mode === 'signin' ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => switchMode('signup')}
              style={styles.createAccount}
            >
              <Sparkles size={15} color={COLORS.primaryDark} />
              <Text style={styles.createAccountText}>New here? Create your account</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => switchMode('signin')}
              style={styles.retry}
            >
              <Text style={styles.link}>I already have an account</Text>
            </TouchableOpacity>
          )}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 22, paddingVertical: 30, width: '100%', maxWidth: 560, alignSelf: 'center', flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 6 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 2.2, color: COLORS.goldDeep },
  brand: { marginTop: 6, color: COLORS.primaryDark, fontSize: 27, fontWeight: '900', letterSpacing: 4 },
  rapoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 16, marginTop: 4,
  },
  mascotWrap: { width: 96, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 10 },
  bubble: {
    flex: 1, minWidth: 0,
    backgroundColor: COLORS.parchment,
    borderRadius: 18, borderTopLeftRadius: 6,
    borderWidth: 1, borderColor: COLORS.gold,
    paddingHorizontal: 13, paddingVertical: 11,
    ...THEME.shadow.soft,
  },
  bubbleText: { fontSize: 12.8, lineHeight: 18.5, color: COLORS.cocoa, fontWeight: '600' },
  bubbleHear: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7, minHeight: 24 },
  bubbleHearText: { fontSize: 10.5, fontWeight: '800', color: COLORS.cocoaSoft },
  card: { backgroundColor: COLORS.cardBackground, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: COLORS.border, width: '100%', ...THEME.shadow.soft },
  modeSwitch: {
    flexDirection: 'row', backgroundColor: COLORS.surfaceMuted, borderRadius: THEME.radius.pill,
    padding: 4, marginBottom: 16, gap: 4,
  },
  modeTab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: THEME.radius.pill },
  modeTabActive: { backgroundColor: COLORS.cardBackground, ...THEME.shadow.soft },
  modeTabText: { fontSize: 12.5, fontWeight: '800', color: COLORS.textSecondary },
  modeTabTextActive: { color: COLORS.primaryDark },
  title: { fontSize: 23, fontWeight: '900', color: COLORS.textPrimary },
  subtitle: { fontSize: 13.5, lineHeight: 20, color: COLORS.textSecondary, marginTop: 6, marginBottom: 20 },
  googleButton: { alignItems: 'center', minHeight: 48, justifyContent: 'center', width: '100%' },
  domain: { textAlign: 'center', fontSize: 12, lineHeight: 18, color: COLORS.textSecondary, marginVertical: 12 },
  info: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  link: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 8, marginTop: -6, marginBottom: 10 },
  retry: { alignItems: 'center', padding: 14, minHeight: 44, justifyContent: 'center' },
  createAccount: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48, marginTop: 8, borderRadius: THEME.radius.pill,
    backgroundColor: COLORS.goldLight, borderWidth: 1, borderColor: COLORS.gold,
  },
  createAccountText: { fontSize: 13, fontWeight: '900', color: COLORS.cocoa },
  errorBox: { backgroundColor: COLORS.dangerLight, borderRadius: 12, padding: 12, marginTop: 14, gap: 10 },
  error: { color: COLORS.danger, fontSize: 13, lineHeight: 19 },
  security: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 20 },
  securityText: { color: COLORS.textSecondary, fontSize: 11, flexShrink: 1 },
  demoBox: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  demoKicker: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: COLORS.goldDeep },
  demoNote: { color: COLORS.textSecondary, fontSize: 11.5, lineHeight: 17, marginTop: 3, marginBottom: 10 },
  footer: { alignItems: 'center', padding: 18, marginTop: 4 },
});
