import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import COLORS from '../../constants/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const goHome = (user) => router.replace(user?.role === 'admin' ? '/admin/dashboard' : '/(tabs)/home');

  const handlePasswordLogin = async () => {
    setError('');
    if (!email.trim() || !password) return setError('Enter your email and password.');
    const res = await login(email.trim().toLowerCase(), password);
    if (res.success) goHome(res.user);
    else setError(res.message || 'Invalid credentials');
  };

  const handleDemoLogin = async () => {
    setError('');
    const res = await login('demo@wrapchik.example', 'WrapchikDemo2026!');
    if (res.success) goHome(res.user);
    else setError(res.message || 'Demo login is unavailable.');
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
          <Text style={styles.subtitle}>Sign in with your email and password.</Text>

          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry />
          <Button title="Sign In" onPress={handlePasswordLogin} loading={isLoading} style={styles.mainButton} />
          {process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGIN === 'true' && (
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Just exploring?</Text>
              <Text style={styles.demoNote}>Try the shared student demo. Use sample details only.</Text>
              <Button title="Try Demo" variant="outline" onPress={handleDemoLogin} loading={isLoading} />
            </View>
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
  scrollContent: { padding: 22, paddingTop: 42, paddingBottom: 36 },
  hero: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 62, height: 62, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  logoText: { color: '#FFF', fontSize: 34, fontWeight: '900' },
  brand: { marginTop: 12, color: COLORS.textPrimary, fontSize: 23, fontWeight: '900', letterSpacing: 2 },
  tagline: { marginTop: 5, color: COLORS.textSecondary, fontSize: 13 },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F0E5DE', elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  title: { fontSize: 25, fontWeight: '900', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 18 },
  mainButton: { marginTop: 4 },
  demoBox: { marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#F0E5DE' },
  demoTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  demoNote: { fontSize: 12, color: COLORS.textSecondary, marginTop: 5, marginBottom: 12 },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 10, marginTop: 12, fontSize: 12, fontWeight: '700' },
  securityRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 18 },
  securityText: { color: COLORS.textSecondary, fontSize: 11 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: COLORS.textSecondary, fontSize: 13 },
  link: { color: COLORS.primary, fontWeight: '900', fontSize: 13 },
});
