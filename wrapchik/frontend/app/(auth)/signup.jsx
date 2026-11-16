import React, {
  useState,
  useContext,
} from 'react';

import {
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { useRouter } from 'expo-router';

import { AuthContext } from '../../context/AuthContext';

import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

import COLORS from '../../constants/colors';

export default function SignupScreen() {
  const router = useRouter();

  const {
    register,
    isLoading,
  } = useContext(AuthContext);

  const [name, setName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [errors, setErrors] =
    useState({});

  const validate = () => {
    const err = {};

    if (!name.trim() || name.trim().length > 80) {
      err.name = 'Enter a name between 1 and 80 characters';
    }

    if (!/^[^\s@]+@thapar\.edu$/i.test(email.trim())) {
      err.email = 'Use your @thapar.edu student email';
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      err.phone = 'Enter a valid phone number with country code if needed';
    }

    if (
      !/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(
        password
      )
    ) {
      err.password = 'Use 8–128 characters with at least one letter and one number';
    }

    if (
      password !==
      confirmPassword
    ) {
      err.confirmPassword =
        'Passwords do not match';
    }

    setErrors(err);

    return (
      Object.keys(err)
        .length === 0
    );
  };

  const handleSignup = async () => {
    if (!validate()) {
      return;
    }

    const result =
      await register(
        name,
        email,
        phone,
        password
      );

    if (!result.success) {
      setErrors((current) => ({ ...current, server: result.message || 'Unable to create account' }));
      return;
    }

    router.push({
      pathname: '/(auth)/email-verification',
      params: {
        email: email.trim().toLowerCase(),
        purpose: 'SIGNUP',
        resendAfterSeconds: result.resendAfterSeconds || 60,
        expiresInSeconds: result.expiresInSeconds || 600,
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.brand}>
        WRAPCHIK
      </Text>

      <Text style={styles.title}>
        Create your account
      </Text>

      <Text style={styles.subtitle}>
        Order your campus food
        in seconds
      </Text>

      <Input
        label="Full Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        error={errors.name}
      />

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@thapar.edu"
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />

      <Input
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="9876543210"
        keyboardType="phone-pad"
        error={errors.phone}
      />

      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="8+ characters"
        secureTextEntry
        showPasswordToggle
        error={errors.password}
      />

      <Input
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Repeat password"
        secureTextEntry
        showPasswordToggle
        error={errors.confirmPassword}
      />

      <Button
        title="Create Account"
        onPress={handleSignup}
        loading={isLoading}
        style={{
          marginTop: 10,
        }}
      />
      {errors.server ? <Text accessibilityRole="alert" style={styles.serverError}>{errors.server}</Text> : null}

      <Text style={styles.loginText}>
        Already have an account?
      </Text>

      <Button
        title="Sign In"
        variant="outline"
        onPress={() =>
          router.push(
            '/(auth)/login'
          )
        }
        style={{
          marginTop: 10,
        }}
      />
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#FFFFFF',
    },

    content: {
      padding: 24,
      paddingTop: 70,
    },

    brand: {
      fontSize: 32,
      fontWeight: '900',
      color: COLORS.primary,
      marginBottom: 20,
    },

    title: {
      fontSize: 28,
      fontWeight: '900',
      color: COLORS.textPrimary,
    },

    subtitle: {
      marginTop: 6,
      marginBottom: 30,
      color: COLORS.textSecondary,
    },

    loginText: {
      textAlign: 'center',
      marginTop: 25,
      color: COLORS.textSecondary,
    },
    serverError: {
      color: COLORS.danger,
      backgroundColor: COLORS.dangerLight,
      borderRadius: 10,
      padding: 12,
      marginTop: 12,
      fontWeight: '700',
    },
  });
